/**
 * Canonical Gemini Developer API (Gen AI) model IDs for Storyception.
 * @see google_models_names_to_use.md
 */

export const GEMINI_MODEL_PRO = 'gemini-3.1-pro-preview' as const
export const GEMINI_MODEL_FLASH = 'gemini-3-flash-preview' as const
export const GEMINI_MODEL_IMAGE = 'gemini-3-pro-image-preview' as const

export type GeminiTextModelId =
  | typeof GEMINI_MODEL_PRO
  | typeof GEMINI_MODEL_FLASH

/** Initial story workflow: default Pro; set STORY_WORKFLOW_NARRATIVE_MODEL=flash for Flash (global endpoint). */
export function getInitialStoryNarrativeModel(): GeminiTextModelId {
  const v = process.env.STORY_WORKFLOW_NARRATIVE_MODEL?.trim().toLowerCase()
  if (v === 'flash' || v === GEMINI_MODEL_FLASH) return GEMINI_MODEL_FLASH
  return GEMINI_MODEL_PRO
}

/** Branch ADK narrative: default Pro; set STORY_BRANCH_NARRATIVE_MODEL=flash for faster branch blurbs. */
export function getBranchNarrativeModel(): GeminiTextModelId {
  const v = process.env.STORY_BRANCH_NARRATIVE_MODEL?.trim().toLowerCase()
  if (v === 'flash' || v === GEMINI_MODEL_FLASH) return GEMINI_MODEL_FLASH
  return GEMINI_MODEL_PRO
}

/** Visual planner / tool-calling agent loop: always reasoning model (not the image model). */
export function getVisualPlannerModel(): typeof GEMINI_MODEL_PRO {
  return GEMINI_MODEL_PRO
}
