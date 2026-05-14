/**
 * Sets up the environment variables `@google/genai` reads at client construction
 * time. Import this once, near the top of any server entrypoint that calls Gemini
 * (the workflows file already does so).
 *
 * Modes (mirror `lib/gemini-client.ts`):
 *   - **Vertex project (ADC) [DEFAULT — what production uses]**
 *     `GOOGLE_GENAI_USE_VERTEXAI=1`, `GOOGLE_GENAI_VERTEX_USE_GCP_PROJECT=1`,
 *     plus a project id (`GOOGLE_CLOUD_PROJECT`) and ADC credentials on disk
 *     (run `gcloud auth application-default login` once per machine).
 *
 *   - **Vertex Express (API key) — LEGACY, KEPT FOR FUTURE FLEXIBILITY**
 *     `GOOGLE_GENAI_USE_VERTEXAI=1` with an API key but no project flag.
 *     ⚠️ Most "AQ.*" account-bound keys are rejected by Vertex AI's
 *     PredictionService with ACCESS_TOKEN_TYPE_UNSUPPORTED. See
 *     `GOOGLE_AUTH_AND_PIPELINE_NOTES_2026-05-14.md` for the full story.
 *
 *   - **Developer API (API key)** — neither flag set; uses
 *     `generativelanguage.googleapis.com`. Only useful for AI Studio-style keys
 *     (`AIza*`); 3.x preview models are not always exposed here.
 */
function envFlag(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}

const projectId =
  process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
  process.env.GOOGLE_CLOUD_PROJECT_ID?.trim() ||
  ''

if (!process.env.GOOGLE_CLOUD_PROJECT && projectId) {
  process.env.GOOGLE_CLOUD_PROJECT = projectId
}

const wantsVertex = envFlag('GOOGLE_GENAI_USE_VERTEXAI')
const wantsVertexProject = envFlag('GOOGLE_GENAI_VERTEX_USE_GCP_PROJECT') && Boolean(projectId)

// Vertex Express: GOOGLE_GENAI_USE_VERTEXAI=true + API key + no project flow.
const expressApiKey =
  process.env.GOOGLE_CLOUD_API_KEY?.trim() ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
  process.env.GOOGLE_GENAI_API_KEY?.trim() ||
  process.env.GEMINI_API_KEY?.trim() ||
  process.env.GOOGLE_API_KEY?.trim() ||
  ''

const useVertex = wantsVertex && (wantsVertexProject || Boolean(expressApiKey))

if (useVertex) {
  process.env.GOOGLE_GENAI_USE_VERTEXAI = '1'
} else {
  process.env.GOOGLE_GENAI_USE_VERTEXAI = '0'
}

// Project+ADC mode: do NOT export any API key. `@google/adk` / `@google/genai`
// will otherwise log "API key will take precedence over project/location" and
// route to a surface that rejects the key with ACCESS_TOKEN_TYPE_UNSUPPORTED.
if (useVertex && wantsVertexProject) {
  delete process.env.GOOGLE_GENAI_API_KEY
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
  // Keep GOOGLE_CLOUD_API_KEY / GEMINI_API_KEY / GOOGLE_API_KEY in env for
  // other tools (e.g. FAL, n8n side calls), but make sure ADC wins for ADK/genai.
} else {
  // Vertex Express (no project) or Developer API: ensure GOOGLE_GENAI_API_KEY is set.
  const resolved =
    useVertex && !wantsVertexProject
      ? expressApiKey
      : process.env.GOOGLE_GENAI_API_KEY?.trim() ||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
        process.env.GEMINI_API_KEY?.trim() ||
        process.env.GOOGLE_API_KEY?.trim() ||
        process.env.GOOGLE_CLOUD_API_KEY?.trim() ||
        ''

  if (resolved && !process.env.GOOGLE_GENAI_API_KEY) {
    process.env.GOOGLE_GENAI_API_KEY = resolved
  }
}
