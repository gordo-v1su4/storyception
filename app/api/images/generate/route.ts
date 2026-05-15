import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import {
  updateKeyframe,
  updateBeat
} from '@/lib/nocodb'
import { getGeminiApiKey } from '@/lib/gemini-api-key'
import {
  generateStoryboardGridBase64,
  type StoryboardReferenceImagePart,
} from '@/lib/gemini-storyboard-image'
import { uploadBufferViaMediaApi } from '@/lib/object-storage'

/** Avoid regex on multi‑MB data URLs — `.+` / dotAll can blow the regexp stack. */
const DATA_URL_MAX_BYTES = 35 * 1024 * 1024

function parseDataUrlBase64(s: string): StoryboardReferenceImagePart | null {
  if (!s.startsWith('data:')) return null
  const sep = ';base64,'
  const i = s.indexOf(sep)
  if (i === -1) return null
  const mimeType = s.slice(5, i).trim() || 'image/png'
  const base64 = s.slice(i + sep.length)
  if (base64.length > DATA_URL_MAX_BYTES) {
    throw new Error('Reference data URL exceeds maximum size')
  }
  return { mimeType, base64 }
}

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s)
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

async function resolveOneReferenceImage(value: string): Promise<StoryboardReferenceImagePart> {
  const trimmed = value.trim()
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
    return { mimeType: mimeMatch(mime) ? mime : 'image/jpeg', base64: buf.toString('base64') }
  }
  return { mimeType: 'image/png', base64: trimmed }
}

async function resolveReferenceImageParts(body: {
  referenceImageBase64?: string
  referenceImageUrl?: string
  referenceImages?: string[]
}): Promise<StoryboardReferenceImagePart[]> {
  const refs = [...(Array.isArray(body.referenceImages) ? body.referenceImages : [])]
  if (typeof body.referenceImageUrl === 'string' && body.referenceImageUrl.trim()) {
    refs.push(body.referenceImageUrl.trim())
  }
  if (typeof body.referenceImageBase64 === 'string' && body.referenceImageBase64.trim()) {
    refs.push(body.referenceImageBase64.trim())
  }

  if (refs.length === 0) {
    throw new Error(
      'Reference image required: pass referenceImageUrl (http/https), referenceImages, or referenceImageBase64'
    )
  }

  const parts: StoryboardReferenceImagePart[] = []
  for (const ref of refs) {
    if (typeof ref !== 'string') continue
    const trimmed = ref.trim()
    if (!trimmed) continue

    const fromDataUrl = parseDataUrlBase64(trimmed)
    if (fromDataUrl) {
      parts.push(fromDataUrl)
      continue
    }

    if (isHttpUrl(trimmed)) {
      const res = await fetch(trimmed)
      if (!res.ok) {
        throw new Error(`Failed to fetch reference image: ${res.status}`)
      }
      const buf = Buffer.from(await res.arrayBuffer())
      const ct = res.headers.get('content-type') || 'image/jpeg'
      const mime = ct.split(';')[0]?.trim() || 'image/jpeg'
      parts.push({ mimeType: mimeMatch(mime) ? mime : 'image/jpeg', base64: buf.toString('base64') })
      continue
    }

    parts.push({ mimeType: 'image/png', base64: trimmed })
  }

  if (parts.length === 0) {
    throw new Error(
      'Reference image required: pass referenceImageUrl (http/https), referenceImages URL/base64, or referenceImageBase64'
    )
  }

  return parts
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
      referenceImages,
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
    const referenceParts = await resolveReferenceImageParts({
      referenceImageBase64,
      referenceImageUrl,
      referenceImages,
    })

    const branchNote =
      typeof branchContext === 'string' && branchContext.trim()
        ? ` Narrative context: ${branchContext.trim()}`
        : ''

    const referenceNote =
      referenceParts.length > 1
        ? ' Use the ordered references as locked visual continuity anchors: original uploaded references first, then clean look sheets, then annotated character sheets.'
        : ' Use the provided reference image as the tone, composition, and identity anchor.'
    const imagePrompt = `Transform the provided reference imagery into a cinematic sequence of 9 keyframes arranged in a 3x3 grid.${referenceNote}${branchNote} Keyframes: ${prompts.join(' | ')}`

    const generatedImageBase64 = await generateStoryboardGridBase64({
      referenceImages: referenceParts,
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
          height: cellHeight,
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
