/**
 * NocoDB Client for Storyception
 * 
 * Manages story sessions, beats, branches, and keyframes
 * Storage: Nextcloud (with public share links)
 * 
 * Tables:
 * - storyception_sessions: User story sessions
 * - storyception_beats: Story beats per session
 * - storyception_branches: Branch options (A/B/C)
 * - storyception_keyframes: Individual keyframe images
 */

const NOCODB_BASE_URL = process.env.NOCODB_BASE_URL || 'https://nocodb.v1su4.com'
const NOCODB_API_TOKEN = process.env.NOCODB_API_TOKEN || ''
const NOCODB_BASE_ID = process.env.NOCODB_BASE_ID || 'pce7ccvwdlz09bx'

// Table IDs (from NocoDB setup)
const TABLES = {
  sessions: process.env.NOCODB_TABLE_SESSIONS || 'm1icipflxgrce6y',
  beats: process.env.NOCODB_TABLE_BEATS || 'ms4mo8ekjtrqz48',
  branches: process.env.NOCODB_TABLE_BRANCHES || 'mypczrrly1k8gsi',
  keyframes: process.env.NOCODB_TABLE_KEYFRAMES || 'm301ac822mwqpy0',
}

// Helper for NocoDB API calls (uses xc-token header per user preference)
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

// ============ SESSION OPERATIONS ============

export interface StorySession {
  'Session ID': string
  'User ID'?: string
  'Archetype': string
  'Outcome': string
  'Reference Image URL'?: string
  'Status': 'active' | 'completed' | 'abandoned'
  'Current Beat': number
  'Total Beats': number
  'Story Data (JSON)'?: string
  'Created At'?: string
  'Updated At'?: string
}

export async function createSession(session: {
  sessionId: string
  userId?: string
  archetype: string
  outcome: string
  referenceImageUrl?: string
  totalBeats?: number
}): Promise<StorySession> {
  const result = await nocodbFetch(`/api/v2/tables/${TABLES.sessions}/records`, {
    method: 'POST',
    body: JSON.stringify({
      'Session ID': session.sessionId,
      'User ID': session.userId || null,
      'Archetype': session.archetype,
      'Outcome': session.outcome,
      'Reference Image URL': session.referenceImageUrl || null,
      'Status': 'active',
      'Current Beat': 1,
      'Total Beats': session.totalBeats || 15,
      'Created At': new Date().toISOString(),
      'Updated At': new Date().toISOString(),
    }),
  })
  return result
}

export async function getSession(sessionId: string): Promise<StorySession | null> {
  try {
    const result = await nocodbFetch(
      `/api/v2/tables/${TABLES.sessions}/records?where=(Session ID,eq,${sessionId})`
    )
    return result.list?.[0] || null
  } catch {
    return null
  }
}

export async function updateSession(sessionId: string, updates: Partial<{
  status: 'active' | 'completed' | 'abandoned'
  currentBeat: number
  storyData: string
}>): Promise<StorySession> {
  const payload: Record<string, unknown> = {
    'Updated At': new Date().toISOString(),
  }
  if (updates.status) payload['Status'] = updates.status
  if (updates.currentBeat) payload['Current Beat'] = updates.currentBeat
  if (updates.storyData) payload['Story Data (JSON)'] = updates.storyData
  
  const result = await nocodbFetch(`/api/v2/tables/${TABLES.sessions}/records`, {
    method: 'PATCH',
    body: JSON.stringify({
      'Session ID': sessionId,
      ...payload,
    }),
  })
  return result
}

// ============ BEAT OPERATIONS ============

export interface StoryBeatRecord {
  'Beat ID': string
  'Session ID': string
  'Beat Index': number
  'Beat Label': string
  'Description'?: string
  'Generated Idea'?: string
  'Duration': string
  'Percent of Total': number
  'Selected Branch ID'?: string
  'Keyframes (JSON)'?: string
  'Status': 'pending' | 'generating' | 'ready' | 'locked'
  'Created At'?: string
}

export async function createBeat(beat: {
  beatId: string
  sessionId: string
  beatIndex: number
  beatLabel: string
  description?: string
  duration: string
  percentOfTotal: number
}): Promise<StoryBeatRecord> {
  const result = await nocodbFetch(`/api/v2/tables/${TABLES.beats}/records`, {
    method: 'POST',
    body: JSON.stringify({
      'Beat ID': beat.beatId,
      'Session ID': beat.sessionId,
      'Beat Index': beat.beatIndex,
      'Beat Label': beat.beatLabel,
      'Description': beat.description || null,
      'Duration': beat.duration,
      'Percent of Total': beat.percentOfTotal,
      'Status': 'pending',
      'Created At': new Date().toISOString(),
    }),
  })
  return result
}

export async function getBeatsForSession(sessionId: string): Promise<StoryBeatRecord[]> {
  const result = await nocodbFetch(
    `/api/v2/tables/${TABLES.beats}/records?where=(Session ID,eq,${sessionId})&sort=Beat Index`
  )
  return result.list || []
}

export async function updateBeat(beatId: string, updates: Partial<{
  generatedIdea: string
  selectedBranchId: string
  keyframesJson: string
  status: 'pending' | 'generating' | 'ready' | 'locked'
}>): Promise<StoryBeatRecord> {
  const payload: Record<string, unknown> = {}
  if (updates.generatedIdea) payload['Generated Idea'] = updates.generatedIdea
  if (updates.selectedBranchId) payload['Selected Branch ID'] = updates.selectedBranchId
  if (updates.keyframesJson) payload['Keyframes (JSON)'] = updates.keyframesJson
  if (updates.status) payload['Status'] = updates.status
  
  const result = await nocodbFetch(`/api/v2/tables/${TABLES.beats}/records`, {
    method: 'PATCH',
    body: JSON.stringify({
      'Beat ID': beatId,
      ...payload,
    }),
  })
  return result
}

// ============ BRANCH OPERATIONS ============

export interface BranchRecord {
  'Branch ID': string
  'Beat ID': string
  'Session ID': string
  'Branch Index': number
  'Branch Type': string
  'Title': string
  'Description'?: string
  'Duration': string
  'Keyframes (JSON)'?: string
  'Is Selected': boolean
  'Inception Depth': number
  'Parent Branch ID'?: string
  'Created At'?: string
}

export async function createBranch(branch: {
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
  const result = await nocodbFetch(`/api/v2/tables/${TABLES.branches}/records`, {
    method: 'POST',
    body: JSON.stringify({
      'Branch ID': branch.branchId,
      'Beat ID': branch.beatId,
      'Session ID': branch.sessionId,
      'Branch Index': branch.branchIndex,
      'Branch Type': branch.branchType,
      'Title': branch.title,
      'Description': branch.description || null,
      'Duration': branch.duration,
      'Is Selected': false,
      'Inception Depth': branch.depth || 0,
      'Parent Branch ID': branch.parentBranchId || null,
      'Created At': new Date().toISOString(),
    }),
  })
  return result
}

export async function getBranchesForBeat(beatId: string): Promise<BranchRecord[]> {
  const result = await nocodbFetch(
    `/api/v2/tables/${TABLES.branches}/records?where=(Beat ID,eq,${beatId})&sort=Branch Index`
  )
  return result.list || []
}

export async function selectBranch(branchId: string, beatId: string): Promise<void> {
  // Get all branches for this beat and deselect them
  const branches = await getBranchesForBeat(beatId)
  for (const branch of branches) {
    if (branch['Is Selected']) {
      await nocodbFetch(`/api/v2/tables/${TABLES.branches}/records`, {
        method: 'PATCH',
        body: JSON.stringify({
          'Branch ID': branch['Branch ID'],
          'Is Selected': false,
        }),
      })
    }
  }
  
  // Select the chosen branch
  await nocodbFetch(`/api/v2/tables/${TABLES.branches}/records`, {
    method: 'PATCH',
    body: JSON.stringify({
      'Branch ID': branchId,
      'Is Selected': true,
    }),
  })
}

// ============ KEYFRAME OPERATIONS ============

export interface KeyframeRecord {
  'Keyframe ID': string
  'Session ID': string
  'Beat ID': string
  'Branch ID'?: string
  'Frame Index (1-9)': number
  'Grid Row': number
  'Grid Col': number
  'Prompt': string
  'Image URL': string
  'Status': 'pending' | 'generating' | 'ready' | 'error'
  'Created At'?: string
}

export async function createKeyframe(keyframe: {
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
  const result = await nocodbFetch(`/api/v2/tables/${TABLES.keyframes}/records`, {
    method: 'POST',
    body: JSON.stringify({
      'Keyframe ID': keyframe.keyframeId,
      'Session ID': keyframe.sessionId,
      'Beat ID': keyframe.beatId,
      'Branch ID': keyframe.branchId || null,
      'Frame Index (1-9)': keyframe.frameIndex,
      'Grid Row': keyframe.row,
      'Grid Col': keyframe.col,
      'Prompt': keyframe.prompt,
      'Image URL': keyframe.imageUrl || null,
      'Status': 'pending',
      'Created At': new Date().toISOString(),
    }),
  })
  return result
}

export async function getKeyframesForBeat(beatId: string, branchId?: string): Promise<KeyframeRecord[]> {
  let where = `(Beat ID,eq,${beatId})`
  if (branchId) {
    where += `~and(Branch ID,eq,${branchId})`
  }
  
  const result = await nocodbFetch(
    `/api/v2/tables/${TABLES.keyframes}/records?where=${where}&sort=Frame Index (1-9)`
  )
  return result.list || []
}

export async function updateKeyframe(keyframeId: string, updates: Partial<{
  imageUrl: string
  status: 'pending' | 'generating' | 'ready' | 'error'
}>): Promise<KeyframeRecord> {
  const payload: Record<string, unknown> = {}
  if (updates.imageUrl) payload['Image URL'] = updates.imageUrl
  if (updates.status) payload['Status'] = updates.status
  
  const result = await nocodbFetch(`/api/v2/tables/${TABLES.keyframes}/records`, {
    method: 'PATCH',
    body: JSON.stringify({
      'Keyframe ID': keyframeId,
      ...payload,
    }),
  })
  return result
}

export async function bulkCreateKeyframes(keyframes: Array<{
  keyframeId: string
  sessionId: string
  beatId: string
  branchId?: string
  frameIndex: number
  row: number
  col: number
  prompt: string
}>): Promise<KeyframeRecord[]> {
  const records = keyframes.map(kf => ({
    'Keyframe ID': kf.keyframeId,
    'Session ID': kf.sessionId,
    'Beat ID': kf.beatId,
    'Branch ID': kf.branchId || null,
    'Frame Index (1-9)': kf.frameIndex,
    'Grid Row': kf.row,
    'Grid Col': kf.col,
    'Prompt': kf.prompt,
    'Image URL': null,
    'Status': 'pending',
    'Created At': new Date().toISOString(),
  }))
  
  const result = await nocodbFetch(`/api/v2/tables/${TABLES.keyframes}/records`, {
    method: 'POST',
    body: JSON.stringify(records),
  })
  return result
}

// ============ UTILITY ============

export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function generateBeatId(sessionId: string, beatIndex: number): string {
  return `${sessionId}-beat-${beatIndex}`
}

export function generateBranchId(beatId: string, branchIndex: number): string {
  return `${beatId}-branch-${String.fromCharCode(65 + branchIndex)}`  // A, B, C
}

export function generateKeyframeId(beatId: string, branchId: string | null, frameIndex: number): string {
  const base = branchId ? `${branchId}` : beatId
  return `${base}-kf-${frameIndex}`
}

// Nextcloud Configuration (S3-compatible storage for public URL access)
const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL || 'https://nextcloud.v1su4.com'
const NEXTCLOUD_USER = process.env.NEXTCLOUD_USER || 'admin'
const NEXTCLOUD_APP_PASSWORD = process.env.NEXTCLOUD_APP_PASSWORD || ''

// Nextcloud WebDAV URL builder (internal path, not public)
export function getNextcloudPath(sessionId: string, beatId: string, frameIndex: number, branchId?: string): string {
  const path = branchId 
    ? `storyception/${sessionId}/${beatId}/${branchId}/keyframe-${frameIndex}.png`
    : `storyception/${sessionId}/${beatId}/keyframe-${frameIndex}.png`
  
  return path
}

// Export config for use in API routes
export const nextcloudConfig = {
  url: NEXTCLOUD_URL,
  user: NEXTCLOUD_USER,
  appPassword: NEXTCLOUD_APP_PASSWORD,
  webdavUrl: `${NEXTCLOUD_URL}/remote.php/dav/files/${NEXTCLOUD_USER}`,
  shareApiUrl: `${NEXTCLOUD_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares`,
}
