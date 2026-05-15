import { createPartFromBase64, createPartFromText, createUserContent, Type } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'
import { createGeminiClient } from '@/lib/gemini-client'
import { GEMINI_MODEL_FLASH } from '@/lib/gemini-models'
import type { CharacterKind } from '@/lib/storyception-schema'
import { normalizeCharacterKind, requireNonEmptyString, resolveInlineImage } from '../_utils'

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

    const imageParts = await Promise.all(imageUrls.map((url) => resolveInlineImage(url)))
    const parts = imageParts.flatMap((image, index) => [
      createPartFromText(`Reference image ${index}: ${imageUrls[index]}`),
      createPartFromBase64(image.base64, image.mimeType),
    ])

    const prompt = `Detect candidate story assets in these uploaded reference images for Storyception session ${sessionId}.
Classify each image as one of: character, environment, prop, unknown.
For each image return one candidate with:
- imageIndex: the zero-based image index
- kind: the best classification
- suggestedName: short editable display name; use "Unknown subject" if unclear
- descriptor: one concise visual/personality/provenance description useful for story planning and character-sheet generation
- confidence: 0 to 1 confidence that the kind is correct.
Do not omit uncertain images; use kind unknown and low confidence instead.`

    const ai = createGeminiClient()
    const res = await ai.models.generateContent({
      model: GEMINI_MODEL_FLASH,
      contents: createUserContent([...parts, createPartFromText(prompt)]),
      config: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        responseSchema: DETECTION_SCHEMA,
      },
    })

    const parsed = JSON.parse((res.text ?? '').trim() || '{"candidates":[]}') as {
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
      const kind = normalizeCharacterKind(raw?.kind)
      return {
        imageUrl,
        kind,
        suggestedName: raw?.suggestedName?.trim() || (kind === 'character' ? `Character ${fallbackIndex + 1}` : 'Unknown subject'),
        descriptor: raw?.descriptor?.trim() || 'Uploaded reference image; details unclear.',
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
