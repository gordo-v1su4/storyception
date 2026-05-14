import { GoogleGenAI } from '@google/genai'
import {
  getGeminiApiKeyForDeveloperApi,
  getGeminiApiKeyForVertexExpress,
} from './gemini-api-key'

function envFlagTrue(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}

function getProjectId(): string | undefined {
  return (
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT_ID?.trim() ||
    undefined
  )
}

/**
 * Project-scoped Vertex (ADC / OAuth, NOT an API key). Canonical Google sample:
 *   `new GoogleGenAI({ vertexai: true, project, location })`
 *
 * Opt-in: `GOOGLE_GENAI_USE_VERTEXAI=true` AND `GOOGLE_GENAI_VERTEX_USE_GCP_PROJECT=1`
 * AND a project id (`GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_PROJECT_ID`). Requires ADC locally
 * (`gcloud auth application-default login`).
 */
function useVertexProject(): boolean {
  return (
    envFlagTrue('GOOGLE_GENAI_USE_VERTEXAI') &&
    envFlagTrue('GOOGLE_GENAI_VERTEX_USE_GCP_PROJECT') &&
    Boolean(getProjectId())
  )
}

/**
 * Gemini client for server routes (`@google/genai`).
 *
 * Default ("Express" / Colab style — matches the official Google sample):
 *   `new GoogleGenAI({ apiKey: process.env.GOOGLE_CLOUD_API_KEY })`
 * Sends the key as `x-goog-api-key` to `generativelanguage.googleapis.com`. Both Vertex Express
 * keys (`AQ.*`) and AI Studio keys (`AIza*`) authenticate at this endpoint.
 *
 * Opt-in project mode: see {@link useVertexProject}.
 *
 * @see https://googleapis.github.io/js-genai/
 */
export function createGeminiClient(): GoogleGenAI {
  if (useVertexProject()) {
    return new GoogleGenAI({
      vertexai: true,
      project: getProjectId()!,
      location: process.env.GOOGLE_CLOUD_LOCATION?.trim() || 'global',
    })
  }

  // Vertex Express order (GOOGLE_CLOUD_API_KEY first) matches the Google sample;
  // fall back to AI Studio env names if no Cloud key set.
  const apiKey = getGeminiApiKeyForVertexExpress() ?? getGeminiApiKeyForDeveloperApi()
  if (!apiKey) {
    throw new Error(
      'No Gemini API key. Set GOOGLE_CLOUD_API_KEY (Vertex Express, AQ.* or AIza*) ' +
        'or any of GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY / GOOGLE_GENAI_API_KEY / GOOGLE_API_KEY.'
    )
  }
  return new GoogleGenAI({ apiKey })
}

/** Same routing as {@link createGeminiClient}, with optional global HTTP overrides for Flash. */
export function createGeminiGlobalClient(): GoogleGenAI {
  const baseUrl = process.env.GEMINI_API_GLOBAL_BASE_URL?.trim()
  const httpOptions = baseUrl
    ? { baseUrl, apiVersion: process.env.GEMINI_API_GLOBAL_VERSION?.trim() || undefined }
    : undefined

  if (useVertexProject()) {
    return new GoogleGenAI({
      vertexai: true,
      project: getProjectId()!,
      location: process.env.GOOGLE_CLOUD_LOCATION?.trim() || 'global',
      ...(httpOptions ? { httpOptions } : {}),
    })
  }

  const apiKey = getGeminiApiKeyForVertexExpress() ?? getGeminiApiKeyForDeveloperApi()
  if (!apiKey) {
    throw new Error(
      'No Gemini API key. Set GOOGLE_CLOUD_API_KEY or GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY.'
    )
  }
  return new GoogleGenAI({
    apiKey,
    ...(httpOptions ? { httpOptions } : {}),
  })
}
