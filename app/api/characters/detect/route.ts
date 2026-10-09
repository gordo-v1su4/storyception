import { Type } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'
import { GEMINI_MODEL_FLASH } from '@/lib/gemini-models'
import { generateStoryJson } from '@/lib/story-text-llm'
import type { CharacterKind } from '@/lib/storyception-schema'
import { normalizeCharacterKind, requireNonEmptyString, resolveInlineImage } from '../_utils'
import { CURRENT_VISUAL_DIRECTIVE } from '@/lib/zeitgeist'

type DetectionCandidate = {
  imageUrl: string
  kind: CharacterKind
  suggestedName: string
  descriptor: string
  confidence: number
}

const DETECTION_SCHEMA = {
  type: Type.OBJECT,
  required: ['candidates'],
  properties: {
    candidates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['imageIndex', 'kind', 'suggestedName', 'descriptor', 'confidence'],
        properties: {
          imageIndex: { type: Type.NUMBER },
          kind: { type: Type.STRING, enum: ['character', 'environment', 'prop', 'unknown'] },
          suggestedName: { type: Type.STRING },
          descriptor: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
        },
      },
    },
  },
}

function clamp01(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Math.max(0, Math.min(1, n))
}

function inferLikelyCharacterFromDescriptor(descriptor: string): boolean {
  return /\b(actor|person|portrait|face|man|woman|heir|protagonist|antihero|character|wardrobe|skin|eyes|hair)\b/i.test(
    descriptor
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const sessionId = requireNonEmptyString(body.sessionId, 'sessionId')
    const imageUrls: string[] = Array.isArray(body.imageUrls)
      ? body.imageUrls.filter((url: unknown): url is string => typeof url === 'string' && url.trim().length > 0)
      : []

    if (imageUrls.length === 0) {
      return NextResponse.json({ success: false, error: 'imageUrls must contain at least one image URL' }, { status: 400 })
    }

    const images = await Promise.all(imageUrls.map((url) => resolveInlineImage(url)))

    const prompt = `Detect candidate story assets in these ${images.length} uploaded reference images for Storyception session ${sessionId}.
The images are given in order; the first is imageIndex 0.
Classify each image as one of: character, environment, prop, unknown.
For each image return one candidate with:
- imageIndex: the zero-based image index
- kind: the best classification
- suggestedName: short editable display name; use "Unknown subject" if unclear
- descriptor: 1–3 production-useful sentences for story planning and premium character-sheet generation: who/what is shown, the setting (location, time of day, weather), any action or event in progress (e.g. someone falling, fleeing, fighting), mood, and real wardrobe/material/lighting/identity cues when visible. If the image is a storyboard, contact sheet, or grid of shots (e.g. 3x3), describe it as a sequence: the action that unfolds across the panels in reading order.
- confidence: 0 to 1 confidence that the kind is correct.
Do not omit uncertain images; use kind unknown and low confidence instead.

${CURRENT_VISUAL_DIRECTIVE}`

    const text = await generateStoryJson({
      prompt,
      system: 'You are a film development researcher cataloguing reference images. Return valid JSON only.',
      images,
      geminiModel: GEMINI_MODEL_FLASH,
      schema: DETECTION_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 4096,
      timeoutMs: Number.parseInt(process.env.GEMINI_TIMEOUT_MS ?? '', 10) || 90_000,
    })

    const parsed = JSON.parse(text || '{"candidates":[]}') as {
      candidates?: Array<{
        imageIndex?: number
        kind?: string
        suggestedName?: string
        descriptor?: string
        confidence?: number
      }>
    }

    const candidates: DetectionCandidate[] = imageUrls.map((imageUrl, fallbackIndex) => {
      const raw = parsed.candidates?.find((c) => c.imageIndex === fallbackIndex) ?? parsed.candidates?.[fallbackIndex]
      const descriptor = raw?.descriptor?.trim() || 'Uploaded reference image; details unclear.'
      const normalizedKind = normalizeCharacterKind(raw?.kind)
      const kind =
        normalizedKind === 'unknown' && inferLikelyCharacterFromDescriptor(descriptor)
          ? 'character'
          : normalizedKind
      return {
        imageUrl,
        kind,
        suggestedName: raw?.suggestedName?.trim() || (kind === 'character' ? `Character ${fallbackIndex + 1}` : 'Unknown subject'),
        descriptor,
        confidence: clamp01(raw?.confidence),
      }
    })

    return NextResponse.json({ success: true, sessionId, candidates })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to detect characters'
    const status = /required|imageUrls|image URL/i.test(message) ? 400 : 500
    console.error('Character detection error:', error)
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
