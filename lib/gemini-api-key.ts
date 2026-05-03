/**
 * Gemini REST (`generativelanguage.googleapis.com`) and native image calls.
 * Prefer GOOGLE_GENERATIVE_AI_API_KEY; fall back to names used by @google/adk / Vertex docs.
 */
export function getGeminiApiKey(): string | undefined {
  const k =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GEMINI_API_KEY
  const t = typeof k === 'string' ? k.trim() : ''
  return t || undefined
}
