import {
  createPartFromBase64,
  createPartFromText,
  createUserContent,
  HarmBlockThreshold,
  HarmCategory,
  Modality,
  type GenerateContentConfig,
} from '@google/genai'
import { uploadBufferViaMediaApi } from '@/lib/object-storage'
import { buildCharacterLookSheetPrompt, buildCharacterSheetPrompt } from '@/lib/character-mega-prompt'
import { createGeminiClient } from '@/lib/gemini-client'
import { GEMINI_MODEL_IMAGE } from '@/lib/gemini-models'
import { createCharacter, generateCharacterId, updateCharacter } from '@/lib/nocodb'
import type { CharacterKind, CharacterRecord } from '@/lib/storyception-schema'
import type { ArchetypeCategoryId } from '@/lib/types'

const DATA_URL_MAX_BYTES = 35 * 1024 * 1024
const VALID_KINDS = new Set<CharacterKind>(['character', 'environment', 'prop', 'unknown'])

export type InlineImage = { mimeType: string; base64: string }

export function normalizeCharacterKind(kind: unknown): CharacterKind {
  return typeof kind === 'string' && VALID_KINDS.has(kind as CharacterKind)
    ? (kind as CharacterKind)
    : 'unknown'
}

export function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`)
  }
  return value.trim()
}

function parseDataUrlBase64(value: string): InlineImage | null {
  if (!value.startsWith('data:')) return null
  const sep = ';base64,'
  const i = value.indexOf(sep)
  if (i === -1) return null
  const mimeType = value.slice(5, i).trim() || 'image/png'
  const base64 = value.slice(i + sep.length)
  if (base64.length > DATA_URL_MAX_BYTES) {
    throw new Error('Reference data URL exceeds maximum size')
  }
  return { mimeType: isSupportedImageMime(mimeType) ? mimeType : 'image/png', base64 }
}

function isSupportedImageMime(mimeType: string): boolean {
  return /^image\/(png|jpe?g|webp|gif)$/i.test(mimeType)
}

export async function resolveInlineImage(imageUrl: string): Promise<InlineImage> {
  const trimmed = requireNonEmptyString(imageUrl, 'imageUrl')
  const dataUrl = parseDataUrlBase64(trimmed)
  if (dataUrl) return dataUrl
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('Image URL must be http(s) or a base64 data URL')
  }

  const res = await fetch(trimmed)
  if (!res.ok) {
    throw new Error(`Failed to fetch image (${res.status})`)
  }
  const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
  const buffer = Buffer.from(await res.arrayBuffer())
  return {
    mimeType: isSupportedImageMime(contentType) ? contentType : 'image/jpeg',
    base64: buffer.toString('base64'),
  }
}

function characterImageConfig(overrides?: Pick<GenerateContentConfig, 'abortSignal'>): GenerateContentConfig {
  return {
    temperature: 1,
    topP: 0.95,
    maxOutputTokens: 32768,
    responseModalities: [Modality.TEXT, Modality.IMAGE],
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
    imageConfig: {
      aspectRatio: '16:9',
      imageSize: '4K',
      outputMimeType: 'image/png',
    },
    abortSignal: overrides?.abortSignal,
  }
}

export async function generateCharacterImageBase64(params: {
  sourceImage: InlineImage
  prompt: string
  abortSignal?: AbortSignal
}): Promise<string> {
  const ai = createGeminiClient()
  const res = await ai.models.generateContent({
    model: GEMINI_MODEL_IMAGE,
    contents: createUserContent([
      createPartFromBase64(params.sourceImage.base64, params.sourceImage.mimeType),
      createPartFromText(params.prompt),
    ]),
    config: characterImageConfig({ abortSignal: params.abortSignal }),
  })

  const parts = res.candidates?.[0]?.content?.parts ?? []
  for (const part of parts) {
    const data = part.inlineData?.data
    if (typeof data === 'string' && data.length > 0) return data
  }
  throw new Error('No image data in Gemini character image response')
}

async function storeGeneratedCharacterImage(args: {
  imageBase64: string
  fileName: string
  sessionId: string
  characterId: string
}): Promise<string> {
  if (!process.env.MEDIA_API_TOKEN && process.env.NODE_ENV === 'development') {
    return `data:image/png;base64,${args.imageBase64}`
  }

  const uploaded = await uploadBufferViaMediaApi({
    buffer: Buffer.from(args.imageBase64, 'base64'),
    fileName: args.fileName,
    contentType: 'image/png',
    folder: `sessions/${args.sessionId}/characters/${args.characterId}`,
    bucket: process.env.STORYCEPTION_MEDIA_BUCKET || 'storyception',
  })
  return uploaded.publicUrl
}

export async function upsertDraftCharacter(args: {
  sessionId: string
  characterId?: string
  index?: number
  name: string
  kind: CharacterKind
  descriptor?: string
  sourceImageUrl: string
  sheetImageUrl?: string
  lookSheetImageUrl?: string
  lookLabel?: string
  megaPrompt?: string
}): Promise<CharacterRecord> {
  const characterId = args.characterId?.trim() || generateCharacterId(args.sessionId, Number.isInteger(args.index) ? args.index! : Date.now())
  const updates = {
    name: args.name,
    kind: args.kind,
    descriptor: args.descriptor ?? '',
    sourceImageUrl: args.sourceImageUrl,
    sheetImageUrl: args.sheetImageUrl,
    lookSheetImageUrl: args.lookSheetImageUrl,
    lookLabel: args.lookLabel ?? 'Default',
    megaPrompt: args.megaPrompt,
  }

  try {
    return await updateCharacter(characterId, updates)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/not found/i.test(message)) throw error
    return createCharacter({
      characterId,
      sessionId: args.sessionId,
      ...updates,
    })
  }
}

export async function generateAndStoreCharacterSheet(args: {
  sessionId: string
  characterId?: string
  index?: number
  name: string
  kind: CharacterKind
  descriptor?: string
  archetypeCategory?: ArchetypeCategoryId
  sourceImageUrl: string
}): Promise<{ character: CharacterRecord; sheetImageUrl: string }> {
  const prompt = buildCharacterSheetPrompt({
    name: args.name,
    role: args.kind === 'character' ? 'story character' : args.kind,
    coreTraits: args.descriptor,
    archetypeCategory: args.archetypeCategory,
  })
  const draft = await upsertDraftCharacter({ ...args, megaPrompt: prompt })
  const sourceImage = await resolveInlineImage(args.sourceImageUrl)
  const imageBase64 = await generateCharacterImageBase64({
    sourceImage,
    prompt,
    abortSignal: AbortSignal.timeout(Number.parseInt(process.env.GEMINI_IMAGE_TIMEOUT_MS ?? '', 10) || 180_000),
  })
  const sheetImageUrl = await storeGeneratedCharacterImage({
    imageBase64,
    fileName: 'sheet.png',
    sessionId: args.sessionId,
    characterId: draft.character_id,
  })
  const character = await updateCharacter(draft.character_id, {
    sheetImageUrl,
    megaPrompt: prompt,
  })
  return { character, sheetImageUrl }
}

export async function generateAndStoreCharacterLookSheet(args: {
  sessionId: string
  characterId?: string
  index?: number
  name: string
  kind: CharacterKind
  descriptor?: string
  archetypeCategory?: ArchetypeCategoryId
  sourceImageUrl: string
  lookLabel?: string
}): Promise<{ character: CharacterRecord; lookSheetImageUrl: string; lookLabel: string }> {
  const lookLabel = args.lookLabel?.trim() || 'Default'
  const prompt = buildCharacterLookSheetPrompt({
    name: args.name,
    descriptor: args.descriptor,
    archetypeCategory: args.archetypeCategory,
    wardrobeLabel: lookLabel,
  })
  const draft = await upsertDraftCharacter({ ...args, lookLabel, megaPrompt: prompt })
  const sourceImage = await resolveInlineImage(args.sourceImageUrl)
  const imageBase64 = await generateCharacterImageBase64({
    sourceImage,
    prompt,
    abortSignal: AbortSignal.timeout(Number.parseInt(process.env.GEMINI_IMAGE_TIMEOUT_MS ?? '', 10) || 180_000),
  })
  const lookSheetImageUrl = await storeGeneratedCharacterImage({
    imageBase64,
    fileName: `looksheet_${lookLabel.replace(/[^a-z0-9_-]+/gi, '_')}.png`,
    sessionId: args.sessionId,
    characterId: draft.character_id,
  })
  const character = await updateCharacter(draft.character_id, {
    lookSheetImageUrl,
    lookLabel,
    megaPrompt: prompt,
  })
  return { character, lookSheetImageUrl, lookLabel }
}
