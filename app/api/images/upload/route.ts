import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { uploadBufferViaMediaApi } from "@/lib/object-storage"

async function inlineDataUrlFromFile(file: File, buffer: Buffer): Promise<string> {
  let mime = file.type || "image/png"
  let out = buffer
  if (process.env.NODE_ENV === "development") {
    try {
      out = await sharp(buffer)
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 86 })
        .toBuffer()
      mime = "image/jpeg"
    } catch (error) {
      console.warn("Failed to downscale inline dev upload; using original file:", error)
    }
  }
  return `data:${mime};base64,${out.toString("base64")}`
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll("images")
    if (!files || files.length === 0) {
      return NextResponse.json({ success: false, error: "No images provided" }, { status: 400 })
    }

    // Local dev without the shared media API: fal.image models can use data URLs.
    if (!process.env.MEDIA_API_TOKEN) {
      if (process.env.NODE_ENV !== "development") {
        return NextResponse.json(
          {
            success: false,
            error:
              "MEDIA_API_TOKEN not configured. Set MEDIA_API_BASE_URL and MEDIA_API_TOKEN in .env.local, or run bun dev to use inline reference images in development only.",
          },
          { status: 500 }
        )
      }

      const urls: string[] = []
      for (const file of files) {
        if (!(file instanceof File)) continue
        const arrayBuffer = await file.arrayBuffer()
        urls.push(await inlineDataUrlFromFile(file, Buffer.from(arrayBuffer)))
      }
      if (urls.length === 0) {
        return NextResponse.json({ success: false, error: "No valid image files" }, { status: 400 })
      }
      return NextResponse.json({ success: true, urls })
    }

    const batchId = `ref-${Date.now()}`
    const urls: string[] = []
    const assets: Array<{ bucket: string; objectKey: string; publicUrl: string }> = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!(file instanceof File)) {
        continue
      }

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const ext = file.name.split(".").pop() || "png"
      const safeName = `ref-${i + 1}.${ext}`
      const uploaded = await uploadBufferViaMediaApi({
        buffer,
        fileName: safeName,
        contentType: file.type || "image/png",
        folder: `references/${batchId}`,
        bucket: process.env.STORYCEPTION_MEDIA_BUCKET || "storyception",
      })
      urls.push(uploaded.publicUrl)
      assets.push(uploaded)
    }

    if (urls.length === 0 || assets.length === 0) {
      return NextResponse.json({ success: false, error: "Failed to upload reference images" }, { status: 500 })
    }

    return NextResponse.json({ success: true, urls, assets })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    )
  }
}
