/**
 * Narrative text generation (pitches, opening story, progressive beats, branches).
 *
 * Provider: Kimi (OpenAI-compatible chat completions) when `KIMI_API_KEY` is set,
 * otherwise Gemini. Force one with `STORY_TEXT_PROVIDER=kimi|gemini`.
 * Image generation and vision (character detection) stay on Gemini.
 */

import { createPartFromBase64, createPartFromText, createUserContent, type SchemaUnion } from '@google/genai'
import { createGeminiClient } from './gemini-client'
import type { GeminiTextModelId } from './gemini-models'

const KIMI_DEFAULT_BASE_URL = 'https://api.kimi.com/coding/v1'
const KIMI_DEFAULT_MODEL = 'k3'

export type StoryTextProvider = 'kimi' | 'gemini'

export interface StoryInlineImage {
  base64: string
  mimeType: string
}

export interface StoryJsonRequest {
  prompt: string
  system: string
  /** Images sent ahead of the prompt (vision input). */
  images?: StoryInlineImage[]
  /** Gemini model used when the provider resolves to Gemini. */
  geminiModel: GeminiTextModelId
  /** Gemini structured-output schema; also described to Kimi in the system prompt. */
  schema?: SchemaUnion
  temperature: number
  maxOutputTokens: number
  timeoutMs: number
}

function kimiApiKey(): string | undefined {
  return process.env.KIMI_API_KEY?.trim() || undefined
}

export function getStoryTextProvider(): StoryTextProvider {
  const forced = process.env.STORY_TEXT_PROVIDER?.trim().toLowerCase()
  if (forced === 'gemini') return 'gemini'
  if (forced === 'kimi') return 'kimi'
  return kimiApiKey() ? 'kimi' : 'gemini'
}

export function getStoryTextModelLabel(): string {
  return getStoryTextProvider() === 'kimi'
    ? `kimi/${process.env.KIMI_MODEL?.trim() || KIMI_DEFAULT_MODEL}`
    : 'gemini'
}

/** Strips code fences / surrounding prose so `JSON.parse` sees just the object. */
function extractJsonObject(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1]!.trim() : trimmed
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  return start >= 0 && end > start ? body.slice(start, end + 1) : body
}

function kimiCompletionContent(value: unknown): string {
  const choices = (value as { choices?: Array<{ message?: { content?: unknown } }> } | null)?.choices
  const content = choices?.[0]?.message?.content
  return typeof content === 'string' ? content : ''
}

async function generateWithKimi(req: StoryJsonRequest): Promise<string> {
  const apiKey = kimiApiKey()
  if (!apiKey) throw new Error('KIMI_API_KEY is not configured')

  const baseUrl = (process.env.KIMI_API_BASE?.trim() || KIMI_DEFAULT_BASE_URL).replace(/\/$/, '')
  const model = process.env.KIMI_MODEL?.trim() || KIMI_DEFAULT_MODEL
  const schemaHint = req.schema
    ? `\n\nThe JSON object must match this schema (Gemini schema notation):\n${JSON.stringify(req.schema)}`
    : ''

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: `${req.system}${schemaHint}` },
        {
          role: 'user',
          content: req.images?.length
            ? [
                ...req.images.map((image) => ({
                  type: 'image_url',
                  image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
                })),
                { type: 'text', text: req.prompt },
              ]
            : req.prompt,
        },
      ],
      // K3 rejects any temperature other than its default (1); `req.temperature` is Gemini-only.
      max_tokens: Math.max(req.maxOutputTokens, 4096),
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
      stream: false,
    }),
    signal: AbortSignal.timeout(req.timeoutMs),
  })

  const json: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = (json as { error?: { message?: string } } | null)?.error?.message
    throw new Error(`Kimi ${model} returned HTTP ${response.status}${message ? `: ${message.slice(0, 300)}` : ''}`)
  }

  const content = kimiCompletionContent(json).trim()
  if (!content) throw new Error(`Kimi ${model} returned no content`)
  return extractJsonObject(content)
}

async function generateWithGemini(req: StoryJsonRequest): Promise<string> {
  const ai = createGeminiClient()
  const res = await ai.models.generateContent({
    model: req.geminiModel,
    contents: createUserContent([
      ...(req.images ?? []).map((image) => createPartFromBase64(image.base64, image.mimeType)),
      createPartFromText(req.prompt),
    ]),
    config: {
      abortSignal: AbortSignal.timeout(req.timeoutMs),
      temperature: req.temperature,
      maxOutputTokens: req.maxOutputTokens,
      responseMimeType: 'application/json',
      ...(req.schema ? { responseSchema: req.schema } : {}),
      systemInstruction: req.system,
    },
  })
  const text = (res.text ?? '').trim()
  if (!text) throw new Error(`Gemini ${req.geminiModel} returned empty response`)
  return extractJsonObject(text)
}

/** Returns a JSON object string from the configured narrative provider. */
export async function generateStoryJson(req: StoryJsonRequest): Promise<string> {
  const provider = getStoryTextProvider()
  switch (provider) {
    case 'kimi':
      return generateWithKimi(req)
    case 'gemini':
      return generateWithGemini(req)
    default: {
      const exhaustive: never = provider
      throw new Error(`Unknown story text provider: ${String(exhaustive)}`)
    }
  }
}
