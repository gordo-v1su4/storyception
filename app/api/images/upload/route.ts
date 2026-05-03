import { NextRequest, NextResponse } from "next/server"

const NEXTCLOUD_BASE_URL = process.env.NEXTCLOUD_BASE_URL || "https://cloud.v1su4.dev"
const NEXTCLOUD_USERNAME = process.env.NEXTCLOUD_USERNAME || "admin"
const NEXTCLOUD_APP_PASSWORD = process.env.NEXTCLOUD_APP_PASSWORD || ""
const NEXTCLOUD_UPLOAD_PATH = process.env.NEXTCLOUD_UPLOAD_PATH || "/Storyception"

const NEXTCLOUD_WEBDAV_URL = `${NEXTCLOUD_BASE_URL}/remote.php/dav/files/${NEXTCLOUD_USERNAME}`
const NEXTCLOUD_SHARE_API_URL = `${NEXTCLOUD_BASE_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares`

async function nextcloudCreateFolder(path: string) {
  const auth = Buffer.from(`${NEXTCLOUD_USERNAME}:${NEXTCLOUD_APP_PASSWORD}`).toString("base64")
  const parts = path.split("/").filter(Boolean)
  let currentPath = ""
  for (const part of parts) {
    currentPath += `/${part}`
    try {
      await fetch(`${NEXTCLOUD_WEBDAV_URL}${currentPath}/`, {
        method: "MKCOL",
        headers: { Authorization: `Basic ${auth}` },
      })
    } catch {
      // Folder may already exist
    }
  }
}

async function nextcloudUpload(buffer: Buffer, remotePath: string, contentType: string): Promise<boolean> {
  const auth = Buffer.from(`${NEXTCLOUD_USERNAME}:${NEXTCLOUD_APP_PASSWORD}`).toString("base64")
  const folderPath = remotePath.substring(0, remotePath.lastIndexOf("/"))
  await nextcloudCreateFolder(folderPath)
  const response = await fetch(`${NEXTCLOUD_WEBDAV_URL}/${remotePath}`, {
    method: "PUT",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": contentType || "application/octet-stream",
    },
    body: buffer as unknown as BodyInit,
  })
  return response.ok || response.status === 201 || response.status === 204
}

function inlineDataUrlFromFile(file: File, buffer: Buffer): string {
  const mime = file.type || "image/png"
  return `data:${mime};base64,${buffer.toString("base64")}`
}

async function nextcloudCreateShare(path: string): Promise<string | null> {
  const auth = Buffer.from(`${NEXTCLOUD_USERNAME}:${NEXTCLOUD_APP_PASSWORD}`).toString("base64")
  const response = await fetch(NEXTCLOUD_SHARE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "OCS-APIRequest": "true",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      path: `/${path}`,
      shareType: "3",
      permissions: "1",
    }),
  })

  if (response.ok) {
    const text = await response.text()
    const urlMatch = text.match(/<url>([^<]+)<\/url>/)
    if (urlMatch) {
      return urlMatch[1].replace("http://", "https://") + "/download"
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll("images")
    if (!files || files.length === 0) {
      return NextResponse.json({ success: false, error: "No images provided" }, { status: 400 })
    }

    // Local dev without Nextcloud: fal.image models accept data URIs; production should use WebDAV + public URLs.
    if (!NEXTCLOUD_APP_PASSWORD) {
      if (process.env.NODE_ENV !== "development") {
        return NextResponse.json(
          {
            success: false,
            error:
              "NEXTCLOUD_APP_PASSWORD not configured. Set it in .env.local (see env.example), or run `bun dev` to use inline reference images in development only.",
          },
          { status: 500 }
        )
      }

      const urls: string[] = []
      for (const file of files) {
        if (!(file instanceof File)) continue
        const arrayBuffer = await file.arrayBuffer()
        urls.push(inlineDataUrlFromFile(file, Buffer.from(arrayBuffer)))
      }
      if (urls.length === 0) {
        return NextResponse.json({ success: false, error: "No valid image files" }, { status: 400 })
      }
      return NextResponse.json({ success: true, urls })
    }

    const uploadRoot = (NEXTCLOUD_UPLOAD_PATH || "/Storyception")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "") || "Storyception"

    const batchId = `ref-${Date.now()}`
    const urls: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!(file instanceof File)) {
        continue
      }

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const ext = file.name.split(".").pop() || "png"
      const safeName = `ref-${i + 1}.${ext}`
      const remotePath = `${uploadRoot}/references/${batchId}/${safeName}`

      const uploaded = await nextcloudUpload(buffer, remotePath, file.type || "image/png")
      if (!uploaded) {
        return NextResponse.json({ success: false, error: "Failed to upload reference image" }, { status: 500 })
      }

      const shareUrl = await nextcloudCreateShare(remotePath)
      if (shareUrl) {
        urls.push(shareUrl)
      }
    }

    if (urls.length === 0) {
      return NextResponse.json({ success: false, error: "Failed to create share links" }, { status: 500 })
    }

    return NextResponse.json({ success: true, urls })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    )
  }
}
