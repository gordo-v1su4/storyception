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
 * | prompt | image_url | status | created_at |
 *
 * Then open **Swagger** for the base, copy each table’s id from the paths
 * `/api/v3/data/{baseId}/{tableId}/records`, and set all four `NOCODB_TABLE_*` vars in `.env`.
 */

export type SessionStatus = 'active' | 'completed' | 'abandoned'
export type BeatStatus = 'pending' | 'generating' | 'ready' | 'locked' | 'skeleton'
export type KeyframeStatus = 'pending' | 'generating' | 'ready' | 'error'

/** Row shape for `sessions` table / local store. */
export interface StorySession {
  session_id: string
  user_id?: string | null
  archetype: string
  outcome: string
  reference_image_url?: string | null
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
  status: KeyframeStatus
  created_at?: string
  nc_row_id?: number
}
