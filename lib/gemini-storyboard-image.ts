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
      imageSize: '2K',
      outputMimeType: 'image/png',
    },
    abortSignal: overrides?.abortSignal,
  }
}

/**
 * Single 3x3 storyboard grid as base64 (PNG), matching Colab native image flow.
 */
export async function generateStoryboardGridBase64(params: {
  referenceMimeType: string
  referenceBase64: string
  prompt: string
  abortSignal?: AbortSignal
}): Promise<string> {
  const ai = createGeminiClient()
  const res = await ai.models.generateContent({
    model: GEMINI_MODEL_IMAGE,
    contents: createUserContent([
      createPartFromBase64(params.referenceBase64, params.referenceMimeType),
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
