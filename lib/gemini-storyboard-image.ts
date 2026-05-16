import {
  createPartFromBase64,
  createPartFromText,
  createUserContent,
  HarmBlockThreshold,
  HarmCategory,
  Modality,
  type GenerateContentConfig,
} from '@google/genai'
import { createGeminiClient } from './gemini-client'
import { GEMINI_MODEL_IMAGE } from './gemini-models'

export interface StoryboardReferenceImagePart {
  mimeType: string
  base64: string
}

type GenerateStoryboardParams =
  | {
      referenceImages: StoryboardReferenceImagePart[]
      prompt: string
      abortSignal?: AbortSignal
    }
  | {
      referenceMimeType: string
      referenceBase64: string
      prompt: string
      abortSignal?: AbortSignal
    }

export function buildStoryboardImageGenerationConfig(
  overrides?: Pick<GenerateContentConfig, 'abortSignal' | 'maxOutputTokens'>
): GenerateContentConfig {
  return {
    temperature: 1,
    topP: 0.95,
    maxOutputTokens: overrides?.maxOutputTokens ?? 32768,
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
    },
    abortSignal: overrides?.abortSignal,
  }
}

/**
 * Single native 4K storyboard grid as base64 (PNG), matching Colab native image flow.
 * The prompt owns whether this is a 2x2 option board or a 3x3 storyboard board;
 * callers must split the one returned composite image into equal cells.
 * Supports the legacy single-reference call shape and v1 multi-reference contract.
 */
export async function generateStoryboardGridBase64(params: GenerateStoryboardParams): Promise<string> {
  const referenceImages =
    'referenceImages' in params
      ? params.referenceImages
      : [{ mimeType: params.referenceMimeType, base64: params.referenceBase64 }]

  if (referenceImages.length === 0) {
    throw new Error('At least one reference image is required')
  }

  const ai = createGeminiClient()
  const res = await ai.models.generateContent({
    model: GEMINI_MODEL_IMAGE,
    contents: createUserContent([
      ...referenceImages.map((image) => createPartFromBase64(image.base64, image.mimeType)),
      createPartFromText(params.prompt),
    ]),
    config: buildStoryboardImageGenerationConfig({ abortSignal: params.abortSignal }),
  })

  const parts = res.candidates?.[0]?.content?.parts ?? []
  for (const p of parts) {
    const data = p.inlineData?.data
    if (typeof data === 'string' && data.length > 0) return data
  }

  throw new Error('No image data in Gemini image response')
}
