/**
 * Storyception persistence schema (NocoDB v3 `fields` keys + local JSON store).
 *
 * ## NocoDB: create a dedicated base (e.g. “Storyception”)
 *
 * Add **four tables** with display titles below. Use **snake_case** column names exactly as listed
 * (NocoDB: add field → set **Column name** / API name to the snake_case value).
 *
 * ### 1. `storyception_sessions` (or any title — use Meta **table id** in `NOCODB_TABLE_SESSIONS`)
 * | Column            | Suggested type   |
 * |-------------------|------------------|
 * | session_id        | Single line text (unique) |
 * | user_id           | Single line text |
 * | archetype         | Single line text |
 * | outcome           | Single line text |
 * | reference_image_url | Long text      |
 * | reference_image_bucket | Single line text |
 * | reference_image_object_key | Single line text |
 * | reference_storage_provider | Single line text |
 * | status            | Single select: active, completed, abandoned |
 * | current_beat      | Number           |
 * | total_beats       | Number           |
 * | story_data_json   | Long text        |
 * | created_at        | Date time        |
 * | updated_at        | Date time        |
 *
 * ### 2. `storyception_beats`
 * | beat_id | session_id | beat_index | beat_label | description | generated_idea | duration |
 * | percent_of_total | selected_branch_id | keyframes_json | status | created_at |
 *
 * ### 3. `storyception_branches`
 * | branch_id | beat_id | session_id | branch_index | branch_type | title | description |
 * | duration | keyframes_json | is_selected (checkbox) | inception_depth | parent_branch_id | created_at |
 *
 * ### 4. `storyception_keyframes`
 * | keyframe_id | session_id | beat_id | branch_id | frame_index | grid_row | grid_col |
 * | prompt | image_url | storage_bucket | object_key | storage_provider | status | created_at |
 *
 * ### 5. `storyception_characters`
 * | character_id | session_id | name | kind | descriptor | source_image_url |
 * | sheet_image_url | look_sheet_image_url | look_label | mega_prompt | created_at |
 *
 *   - `sheet_image_url`: annotated production board (text, palette, wardrobe breakdown).
 *     For directors/humans — displayed on the canvas character card.
 *   - `look_sheet_image_url`: clean no-writing photo-grid sheet (turnaround + head
 *     studies + detail close-ups). The primary AI reference fed into per-beat keyframe gen.
 *   - `look_label`: which wardrobe/state this look sheet represents (e.g. "Default",
 *     "Shirtless", "Tuxedo"). Future expansion: a character can have multiple look sheets,
 *     one row per look. v1 always stores "Default".
 *
 * Then open **Swagger** for the base, copy each table’s id from the paths
 * `/api/v3/data/{baseId}/{tableId}/records`, and set all five `NOCODB_TABLE_*` vars in `.env`.
 */

export type SessionStatus = 'active' | 'completed' | 'abandoned'
export type BeatStatus = 'pending' | 'generating' | 'ready' | 'locked' | 'skeleton'
export type KeyframeStatus = 'pending' | 'generating' | 'ready' | 'error'
export type CharacterKind = 'character' | 'environment' | 'prop' | 'unknown'

/** Row shape for `sessions` table / local store. */
export interface StorySession {
  session_id: string
  user_id?: string | null
  archetype: string
  outcome: string
  reference_image_url?: string | null
  reference_image_bucket?: string | null
  reference_image_object_key?: string | null
  reference_storage_provider?: string | null
  status: SessionStatus
  current_beat: number
  total_beats: number
  story_data_json?: string | null
  created_at?: string
  updated_at?: string
  /** NocoDB v3 numeric row id (for PATCH). */
  nc_row_id?: number
}

export interface StoryBeatRecord {
  beat_id: string
  session_id: string
  beat_index: number
  beat_label: string
  description?: string | null
  generated_idea?: string | null
  duration: string
  percent_of_total: number
  selected_branch_id?: string | null
  keyframes_json?: string | null
  status: BeatStatus
  created_at?: string
  nc_row_id?: number
}

export interface BranchRecord {
  branch_id: string
  beat_id: string
  session_id: string
  branch_index: number
  branch_type: string
  title: string
  description?: string | null
  duration: string
  keyframes_json?: string | null
  is_selected: boolean
  inception_depth: number
  parent_branch_id?: string | null
  created_at?: string
  nc_row_id?: number
}

export interface KeyframeRecord {
  keyframe_id: string
  session_id: string
  beat_id: string
  branch_id?: string | null
  frame_index: number
  grid_row: number
  grid_col: number
  prompt: string
  image_url: string
  storage_bucket?: string | null
  object_key?: string | null
  storage_provider?: string | null
  status: KeyframeStatus
  created_at?: string
  nc_row_id?: number
}

/**
 * Row shape for the `characters` table.
 *
 *  - `source_image_url`: user's original upload (provenance / re-runs).
 *  - `sheet_image_url`: annotated production board (Kaito Tanaka style). Text,
 *    palette, wardrobe breakdown, turnaround, head studies, cinematic portrait,
 *    callouts. For human directors. Shown on the canvas character card.
 *  - `look_sheet_image_url`: clean no-writing photo-grid sheet (Min/Fang style).
 *    Turnaround + head studies + detail close-ups. ONE per wardrobe/look. The
 *    primary AI reference passed into per-beat keyframe generation alongside the
 *    annotated sheet.
 *  - `look_label`: which look this represents (e.g. "Default", "Shirtless",
 *    "Tuxedo"). v1 always writes "Default"; future expansion adds rows per look.
 *  - `kind === 'character'` means we render sheets for them; environment/prop
 *    uploads are stored with `kind='environment'|'prop'` and only carry the
 *    source url (no sheets rendered).
 */
export interface CharacterRecord {
  character_id: string
  session_id: string
  name: string
  kind: CharacterKind
  descriptor?: string | null
  source_image_url?: string | null
  sheet_image_url?: string | null
  look_sheet_image_url?: string | null
  look_label?: string | null
  mega_prompt?: string | null
  created_at?: string
  nc_row_id?: number
}
