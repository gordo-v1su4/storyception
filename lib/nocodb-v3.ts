/**
 * NocoDB v3 Data API — Storyception schema (`lib/storyception-schema.ts`).
 */

import type {
  BranchRecord,
  KeyframeRecord,
  StoryBeatRecord,
  StorySession,
} from './storyception-schema'
import { referenceImageUrlForPersistence } from './reference-image-persist'

const NOCODB_BASE_URL = process.env.NOCODB_BASE_URL || 'https://nocodb.v1su4.dev'
const NOCODB_API_TOKEN = process.env.NOCODB_API_TOKEN || ''

export const TABLES = {
  sessions: process.env.NOCODB_TABLE_SESSIONS?.trim() || '',
  beats: process.env.NOCODB_TABLE_BEATS?.trim() || '',
  branches: process.env.NOCODB_TABLE_BRANCHES?.trim() || '',
  keyframes: process.env.NOCODB_TABLE_KEYFRAMES?.trim() || '',
}

const NOCODB_BASE_ID = process.env.NOCODB_BASE_ID || ''

type NcV3Record = { id: number; fields: Record<string, unknown> }

function colRef(name: string): string {
  return /[^a-z0-9_]/i.test(name) ? `"${name.replace(/"/g, '\\"')}"` : name
}

function whereEqString(column: string, value: string): string {
  const esc = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return `(${colRef(column)},eq,'${esc}')`
}

/** v3 Data API expects `sort` as JSON array, not a bare column name */
function v3Sort(field: string, direction: 'asc' | 'desc' = 'asc'): string {
  return JSON.stringify([{ field, direction }])
}

function recordsPath(tableId: string) {
  return `/api/v3/data/${NOCODB_BASE_ID}/${tableId}/records`
}

async function nocodbFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${NOCODB_BASE_URL}${endpoint}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'xc-token': NOCODB_API_TOKEN,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`NocoDB Error: ${response.status} - ${error}`)
  }

  return response.json()
}

function unwrapRecord<T extends object>(rec: NcV3Record): T {
  return { ...(rec.fields as T), nc_row_id: rec.id } as T
}

async function fetchRecordsJson(tableId: string, searchParams: URLSearchParams): Promise<NcV3Record[]> {
  const qs = searchParams.toString()
  const result = await nocodbFetch(`${recordsPath(tableId)}${qs ? `?${qs}` : ''}`)
  return (result.records as NcV3Record[]) ?? []
}

async function findOne(tableId: string, where: string): Promise<NcV3Record | null> {
  const params = new URLSearchParams({ where, limit: '1' })
  const rows = await fetchRecordsJson(tableId, params)
  return rows[0] ?? null
}

export function areNocoTablesConfigured(): boolean {
  return !!(TABLES.sessions && TABLES.beats && TABLES.branches && TABLES.keyframes && NOCODB_BASE_ID)
}

export async function probeNocoDbReady(): Promise<boolean> {
  if (!NOCODB_API_TOKEN?.trim() || !areNocoTablesConfigured()) return false
  try {
    const url = `${NOCODB_BASE_URL}${recordsPath(TABLES.sessions)}?limit=1`
    const response = await fetch(url, { headers: { 'xc-token': NOCODB_API_TOKEN } })
    if (response.ok) return true
    const text = await response.text()
    if (response.status === 404 && (text.includes('not found') || text.includes('NOT_FOUND'))) return false
    return false
  } catch {
    return false
  }
}

export async function createSessionV3(session: {
  sessionId: string
  userId?: string
  archetype: string
  outcome: string
  referenceImageUrl?: string
  totalBeats?: number
}): Promise<StorySession> {
  const now = new Date().toISOString()
  const body = {
    fields: {
      session_id: session.sessionId,
      user_id: session.userId ?? null,
      archetype: session.archetype,
      outcome: session.outcome,
      reference_image_url: referenceImageUrlForPersistence(session.referenceImageUrl),
      status: 'active',
      current_beat: 1,
      total_beats: session.totalBeats || 15,
      created_at: now,
      updated_at: now,
    },
  }
  const result = await nocodbFetch(recordsPath(TABLES.sessions), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const rec = (result.records as NcV3Record[])?.[0]
  if (!rec) throw new Error('NocoDB Error: createSession returned no record')
  return unwrapRecord<StorySession>(rec)
}

export async function getSessionV3(sessionId: string): Promise<StorySession | null> {
  try {
    const row = await findOne(TABLES.sessions, whereEqString('session_id', sessionId))
    return row ? unwrapRecord<StorySession>(row) : null
  } catch {
    return null
  }
}

export async function updateSessionV3(
  sessionId: string,
  updates: Partial<{ status: StorySession['status']; currentBeat: number; storyData: string }>
): Promise<StorySession> {
  const existing = await findOne(TABLES.sessions, whereEqString('session_id', sessionId))
  if (!existing) throw new Error(`NocoDB Error: session not found: ${sessionId}`)

  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.status) fields.status = updates.status
  if (updates.currentBeat !== undefined) fields.current_beat = updates.currentBeat
  if (updates.storyData) fields.story_data_json = updates.storyData

  const result = await nocodbFetch(recordsPath(TABLES.sessions), {
    method: 'PATCH',
    body: JSON.stringify({ id: existing.id, fields }),
  })
  const rec = (result.records as NcV3Record[])?.[0]
  if (!rec) throw new Error('NocoDB Error: updateSession returned no record')
  return unwrapRecord<StorySession>(rec)
}

export async function createBeatV3(beat: {
  beatId: string
  sessionId: string
  beatIndex: number
  beatLabel: string
  description?: string
  duration: string
  percentOfTotal: number
}): Promise<StoryBeatRecord> {
  const body = {
    fields: {
      beat_id: beat.beatId,
      session_id: beat.sessionId,
      beat_index: beat.beatIndex,
      beat_label: beat.beatLabel,
      description: beat.description ?? null,
      duration: beat.duration,
      percent_of_total: beat.percentOfTotal,
      status: 'pending',
      created_at: new Date().toISOString(),
    },
  }
  const result = await nocodbFetch(recordsPath(TABLES.beats), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const rec = (result.records as NcV3Record[])?.[0]
  if (!rec) throw new Error('NocoDB Error: createBeat returned no record')
  return unwrapRecord<StoryBeatRecord>(rec)
}

export async function getBeatsForSessionV3(sessionId: string): Promise<StoryBeatRecord[]> {
  const params = new URLSearchParams({
    where: whereEqString('session_id', sessionId),
    sort: v3Sort('beat_index'),
  })
  const rows = await fetchRecordsJson(TABLES.beats, params)
  return rows.map((r) => unwrapRecord<StoryBeatRecord>(r))
}

export async function updateBeatV3(
  beatId: string,
  updates: Partial<{
    description: string
    generatedIdea: string
    selectedBranchId: string
    keyframesJson: string
    status: StoryBeatRecord['status']
  }>
): Promise<StoryBeatRecord> {
  const existing = await findOne(TABLES.beats, whereEqString('beat_id', beatId))
  if (!existing) throw new Error(`NocoDB Error: beat not found: ${beatId}`)

  const fields: Record<string, unknown> = {}
  if (updates.description !== undefined) fields.description = updates.description
  if (updates.generatedIdea !== undefined) fields.generated_idea = updates.generatedIdea
  if (updates.selectedBranchId !== undefined) fields.selected_branch_id = updates.selectedBranchId
  if (updates.keyframesJson !== undefined) fields.keyframes_json = updates.keyframesJson
  if (updates.status !== undefined) fields.status = updates.status

  const result = await nocodbFetch(recordsPath(TABLES.beats), {
    method: 'PATCH',
    body: JSON.stringify({ id: existing.id, fields }),
  })
  const rec = (result.records as NcV3Record[])?.[0]
  if (!rec) throw new Error('NocoDB Error: updateBeat returned no record')
  return unwrapRecord<StoryBeatRecord>(rec)
}

export async function createBranchV3(branch: {
  branchId: string
  beatId: string
  sessionId: string
  branchIndex: number
  branchType: string
  title: string
  description?: string
  duration: string
  depth?: number
  parentBranchId?: string
}): Promise<BranchRecord> {
  const body = {
    fields: {
      branch_id: branch.branchId,
      beat_id: branch.beatId,
      session_id: branch.sessionId,
      branch_index: branch.branchIndex,
      branch_type: branch.branchType,
      title: branch.title,
      description: branch.description ?? null,
      duration: branch.duration,
      is_selected: false,
      inception_depth: branch.depth || 0,
      parent_branch_id: branch.parentBranchId ?? null,
      created_at: new Date().toISOString(),
    },
  }
  const result = await nocodbFetch(recordsPath(TABLES.branches), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const rec = (result.records as NcV3Record[])?.[0]
  if (!rec) throw new Error('NocoDB Error: createBranch returned no record')
  return unwrapRecord<BranchRecord>(rec)
}

export async function getBranchesForBeatV3(beatId: string): Promise<BranchRecord[]> {
  const params = new URLSearchParams({
    where: whereEqString('beat_id', beatId),
    sort: v3Sort('branch_index'),
  })
  const rows = await fetchRecordsJson(TABLES.branches, params)
  return rows.map((r) => unwrapRecord<BranchRecord>(r))
}

export async function selectBranchV3(branchId: string, beatId: string): Promise<void> {
  const branches = await getBranchesForBeatV3(beatId)
  for (const branch of branches) {
    if (branch.nc_row_id === undefined) continue
    if (branch.is_selected) {
      await nocodbFetch(recordsPath(TABLES.branches), {
        method: 'PATCH',
        body: JSON.stringify({ id: branch.nc_row_id, fields: { is_selected: false } }),
      })
    }
  }
  const target = branches.find((b) => b.branch_id === branchId)
  if (target?.nc_row_id === undefined) throw new Error(`NocoDB Error: branch not found: ${branchId}`)
  await nocodbFetch(recordsPath(TABLES.branches), {
    method: 'PATCH',
    body: JSON.stringify({ id: target.nc_row_id, fields: { is_selected: true } }),
  })
}

export async function createKeyframeV3(keyframe: {
  keyframeId: string
  sessionId: string
  beatId: string
  branchId?: string
  frameIndex: number
  row: number
  col: number
  prompt: string
  imageUrl?: string
}): Promise<KeyframeRecord> {
  const body = {
    fields: {
      keyframe_id: keyframe.keyframeId,
      session_id: keyframe.sessionId,
      beat_id: keyframe.beatId,
      branch_id: keyframe.branchId ?? null,
      frame_index: keyframe.frameIndex,
      grid_row: keyframe.row,
      grid_col: keyframe.col,
      prompt: keyframe.prompt,
      image_url: keyframe.imageUrl ?? '',
      status: 'pending',
      created_at: new Date().toISOString(),
    },
  }
  const result = await nocodbFetch(recordsPath(TABLES.keyframes), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const rec = (result.records as NcV3Record[])?.[0]
  if (!rec) throw new Error('NocoDB Error: createKeyframe returned no record')
  return unwrapRecord<KeyframeRecord>(rec)
}

export async function getKeyframesForBeatV3(beatId: string, branchId?: string): Promise<KeyframeRecord[]> {
  let where = whereEqString('beat_id', beatId)
  if (branchId) where += `~and${whereEqString('branch_id', branchId)}`
  const params = new URLSearchParams({ where, sort: v3Sort('frame_index') })
  const rows = await fetchRecordsJson(TABLES.keyframes, params)
  return rows.map((r) => unwrapRecord<KeyframeRecord>(r))
}

export async function updateKeyframeV3(
  keyframeId: string,
  updates: Partial<{ imageUrl: string; status: KeyframeRecord['status'] }>
): Promise<KeyframeRecord> {
  const existing = await findOne(TABLES.keyframes, whereEqString('keyframe_id', keyframeId))
  if (!existing) throw new Error(`NocoDB Error: keyframe not found: ${keyframeId}`)
  const fields: Record<string, unknown> = {}
  if (updates.imageUrl !== undefined) fields.image_url = updates.imageUrl
  if (updates.status !== undefined) fields.status = updates.status
  const result = await nocodbFetch(recordsPath(TABLES.keyframes), {
    method: 'PATCH',
    body: JSON.stringify({ id: existing.id, fields }),
  })
  const rec = (result.records as NcV3Record[])?.[0]
  if (!rec) throw new Error('NocoDB Error: updateKeyframe returned no record')
  return unwrapRecord<KeyframeRecord>(rec)
}

export async function bulkCreateKeyframesV3(
  keyframes: Array<{
    keyframeId: string
    sessionId: string
    beatId: string
    branchId?: string
    frameIndex: number
    row: number
    col: number
    prompt: string
  }>
): Promise<KeyframeRecord[]> {
  const bodies = keyframes.map((kf) => ({
    fields: {
      keyframe_id: kf.keyframeId,
      session_id: kf.sessionId,
      beat_id: kf.beatId,
      branch_id: kf.branchId ?? null,
      frame_index: kf.frameIndex,
      grid_row: kf.row,
      grid_col: kf.col,
      prompt: kf.prompt,
      image_url: '',
      status: 'pending',
      created_at: new Date().toISOString(),
    },
  }))
  const result = await nocodbFetch(recordsPath(TABLES.keyframes), {
    method: 'POST',
    body: JSON.stringify(bodies),
  })
  const recs = (result.records as NcV3Record[]) ?? []
  return recs.map((r) => unwrapRecord<KeyframeRecord>(r))
}
