/**
 * API key for `@google/genai` (Gemini Developer API or Vertex AI API key / “Express” mode),
 * REST image routes, and `@google/adk` when using API-key auth.
 *
 * **Important:** `GOOGLE_CLOUD_API_KEY` is often a **Vertex** key (Colab `vertexai=True`). That key can
 * fail on `generativelanguage.googleapis.com` with `ACCESS_TOKEN_TYPE_UNSUPPORTED` / 401. For the default
 * **Developer API** client, we therefore prefer AI Studio env names **before** `GOOGLE_CLOUD_API_KEY`
 * (aligned with `lib/adk-env.ts`).
 */

function firstNonEmpty(keys: (string | undefined)[]): string | undefined {
  for (const k of keys) {
    const t = typeof k === 'string' ? k.trim() : ''
    if (t) return t
  }
  return undefined
}

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

/** True when Gemini is configured for project-scoped Vertex via ADC/OAuth. */
export function hasVertexProjectAdcAuth(): boolean {
  return (
    envFlagTrue('GOOGLE_GENAI_USE_VERTEXAI') &&
    envFlagTrue('GOOGLE_GENAI_VERTEX_USE_GCP_PROJECT') &&
    Boolean(getProjectId())
  )
}

/** True if any known key env var is non-empty (for “configured?” checks). */
export function getAnyGeminiApiKey(): string | undefined {
  return firstNonEmpty([
    process.env.GOOGLE_GENAI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_CLOUD_API_KEY,
    process.env.GOOGLE_API_KEY,
  ])
}

/**
 * Key for **Gemini Developer API** (`vertexai: false` in `@google/genai`).
 * Prefer AI Studio / ADK names so a Vertex-only `GOOGLE_CLOUD_API_KEY` does not override `GEMINI_API_KEY`.
 */
export function getGeminiApiKeyForDeveloperApi(): string | undefined {
  return firstNonEmpty([
    process.env.GOOGLE_GENAI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_CLOUD_API_KEY,
  ])
}

/** Key for Vertex **Express** (`vertexai: true` + `apiKey`) — Colab-style `GOOGLE_CLOUD_API_KEY` first. */
export function getGeminiApiKeyForVertexExpress(): string | undefined {
  return firstNonEmpty([
    process.env.GOOGLE_CLOUD_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GOOGLE_GENAI_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
  ])
}

/**
 * @deprecated Prefer route-specific checks or {@link hasVertexProjectAdcAuth}.
 * Kept as an alias for “Gemini auth configured” because some API routes only
 * need a fast preflight before constructing the shared Gemini client.
 */
export function getGeminiApiKey(): string | undefined {
  return getAnyGeminiApiKey() ?? (hasVertexProjectAdcAuth() ? 'adc' : undefined)
}
