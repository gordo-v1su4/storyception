/**
 * @google/adk resolves Gemini API keys from GOOGLE_GENAI_API_KEY or GEMINI_API_KEY only.
 * This app standardizes on GOOGLE_GENERATIVE_AI_API_KEY (see env.example / Vercel).
 */
const resolved =
  process.env.GOOGLE_GENAI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (resolved && !process.env.GOOGLE_GENAI_API_KEY) {
  process.env.GOOGLE_GENAI_API_KEY = resolved;
}
