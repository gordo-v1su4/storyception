import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { 
  updateKeyframe, 
  updateBeat
} from '@/lib/nocodb'
import { getGeminiApiKey } from '@/lib/gemini-api-key'
import { generateStoryboardGridBase64 } from '@/lib/gemini-storyboard-image'
import { uploadBufferViaMediaApi } from '@/lib/object-storage'

/** Avoid regex on multi‑MB data URLs — `.+` / dotAll can blow the regexp stack. */
const DATA_URL_MAX_BYTES = 35 * 1024 * 1024

function parseDataUrlBase64(s: string): { mimeType: string; data: string } | null {
  if (!s.startsWith('data:')) return null
  const sep = ';base64,'
  const i = s.indexOf(sep)
  if (i === -1) return null
  const mimeType = s.slice(5, i).trim() || 'image/png'
  const data = s.slice(i + sep.length)
  if (data.length > DATA_URL_MAX_BYTES) {
    throw new Error('Reference data URL exceeds maximum size')
  }
  return { mimeType, data }
}

function normalizeKeyframePrompts(
  raw: unknown,
  ctx: { beatLabel?: string; beatDescription?: string }
): string[] {
  const strings = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : []
  if (strings.length >= 9) return strings.slice(0, 9)
  if (strings.length > 0) {
    const out = [...strings]
    while (out.length < 9) {
      out.push(strings[out.length % strings.length]!)
    }
    return out.slice(0, 9)
  }
  const base = (ctx.beatDescription || ctx.beatLabel || 'Cinematic beat').trim()
  return Array.from(
    { length: 9 },
    (_, i) =>
      `${base} — storyboard panel ${i + 1} of 9, distinct framing and emotion.`
  )
}

async function resolveReferenceImageParts(body: {
  referenceImageBase64?: string
  referenceImageUrl?: string
}): Promise<{ mimeType: string; data: string }> {
  const raw = body.referenceImageBase64
  if (raw && typeof raw === 'string') {
    const trimmed = raw.trim()
    const parsed = parseDataUrlBase64(trimmed)
    if (parsed) return parsed
    return { mimeType: 'image/png', data: trimmed }
  }
  const url = body.referenceImageUrl
  if (url && typeof url === 'string') {
    const trimmed = url.trim()
    const fromDataUrl = parseDataUrlBase64(trimmed)
    if (fromDataUrl) return fromDataUrl
    if (/^https?:\/\//i.test(trimmed)) {
      const res = await fetch(trimmed)
      if (!res.ok) {
        throw new Error(`Failed to fetch reference image: ${res.status}`)
      }
      const buf = Buffer.from(await res.arrayBuffer())
      const ct = res.headers.get('content-type') || 'image/jpeg'
      const mime = ct.split(';')[0]?.trim() || 'image/jpeg'
      return { mimeType: mimeMatch(mime) ? mime : 'image/jpeg', data: buf.toString('base64') }
    }
  }
  throw new Error(
    'Reference image required: pass referenceImageUrl (http/https) or referenceImageBase64'
  )
}

function mimeMatch(m: string): boolean {
  return /^image\/(png|jpeg|jpg|webp|gif)$/i.test(m)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      beatId,
      sessionId,
      keyframePrompts,
      keyframe_prompts,
      referenceImageBase64,
      referenceImageUrl,
      beatLabel,
      beatDescription,
      branchContext,
    } = body

    if (!getGeminiApiKey()) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No Gemini API key: set GOOGLE_CLOUD_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, GOOGLE_GENAI_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY',
        },
        { status: 500 }
      )
    }

    const prompts = normalizeKeyframePrompts(keyframePrompts ?? keyframe_prompts, {
      beatLabel: typeof beatLabel === 'string' ? beatLabel : undefined,
      beatDescription: typeof beatDescription === 'string' ? beatDescription : undefined,
    })
    const { mimeType, data: imageB64 } = await resolveReferenceImageParts({
      referenceImageBase64,
      referenceImageUrl,
    })

    const branchNote =
      typeof branchContext === 'string' && branchContext.trim()
        ? ` Narrative context: ${branchContext.trim()}`
        : ''

    const imagePrompt = `Transform the provided reference image into a cinematic sequence of 9 keyframes arranged in a 3x3 grid.${branchNote} Keyframes: ${prompts.join(' | ')}`

    const generatedImageBase64 = await generateStoryboardGridBase64({
      referenceMimeType: mimeType,
      referenceBase64: imageB64,
      prompt: imagePrompt,
    })

    const gridBuffer = Buffer.from(generatedImageBase64, 'base64')

    // 2. Slice Grid into 9 Keyframes
    const metadata = await sharp(gridBuffer).metadata()
    const cellWidth = Math.floor((metadata.width || 2048) / 3)
    const cellHeight = Math.floor((metadata.height || 1152) / 3)

    const keyframeUrls = []
    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / 3)
      const col = i % 3
      const cellBuffer = await sharp(gridBuffer)
        .extract({ 
          left: col * cellWidth, 
          top: row * cellHeight, 
          width: cellWidth, 
          height: cellHeight 
        })
        .png()
        .toBuffer()

      const uploaded = await uploadBufferViaMediaApi({
        buffer: cellBuffer,
        fileName: `kf-${i + 1}.png`,
        contentType: 'image/png',
        folder: `sessions/${sessionId}/${beatId}`,
        bucket: process.env.STORYCEPTION_MEDIA_BUCKET || 'storyception',
      })

      keyframeUrls.push(uploaded.publicUrl)
      const keyframeId = `${beatId}-kf-${i + 1}`
      await updateKeyframe(keyframeId, {
        imageUrl: uploaded.publicUrl,
        storageBucket: uploaded.bucket,
        objectKey: uploaded.objectKey,
        storageProvider: 'rustfs',
        status: 'ready'
      })
    }

    await updateBeat(beatId, {
      status: 'ready',
      keyframesJson: JSON.stringify({ keyframes: keyframeUrls })
    })

    return NextResponse.json({
      success: true,
      keyframeUrls,
      keyframes: keyframeUrls,
    })

  } catch (error) {
    console.error('Native Image Generation Error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate images'
    const dev = process.env.NODE_ENV === 'development'
    return NextResponse.json(
      { success: false, error: dev ? message : 'Failed to generate images' },
      { status: 500 }
    )
  }
}
