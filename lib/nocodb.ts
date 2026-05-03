/**
 * Story persistence: **NocoDB v3** when the Storyception tables exist on your base,
 * otherwise **local JSON** under `.data/storyception-store.json` (full CRUD, no manual setup).
 *
 * Override: `STORYCEPTION_PERSISTENCE=nocodb` | `file` | `local` (default: auto-detect).
 */

import * as v3 from './nocodb-v3'
import * as local from './storyception-local-store'
import type {
  StorySession,
  StoryBeatRecord,
  BranchRecord,
  KeyframeRecord,
} from './storyception-schema'

export type {
  StorySession,
  StoryBeatRecord,
  BranchRecord,
  KeyframeRecord,
} from './storyception-schema'

export { TABLES } from './nocodb-v3'

let resolvedMode: 'nocodb' | 'file' | null = null
let loggedBackend = false

async function getMode(): Promise<'nocodb' | 'file'> {
  if (resolvedMode) return resolvedMode

  const env = process.env.STORYCEPTION_PERSISTENCE?.toLowerCase()
  if (env === 'file' || env === 'local') {
    resolvedMode = 'file'
  } else if (env === 'nocodb') {
    resolvedMode = 'nocodb'
  } else {
    const ok = await v3.probeNocoDbReady()
    resolvedMode = ok ? 'nocodb' : 'file'
  }

  if (!loggedBackend) {
    const hint =
      resolvedMode === 'nocodb'
        ? 'NocoDB v3 (Storyception tables found)'
        : 'local file .data/storyception-store.json — set STORYCEPTION_PERSISTENCE=nocodb to force remote'
    console.info(`[storyception] persistence: ${hint}`)
    loggedBackend = true
  }

  return resolvedMode
}

/** Current backend after first async call (`null` until then). */
export function getPersistenceMode(): 'nocodb' | 'file' | null {
  return resolvedMode
}

export async function createSession(session: {
  sessionId: string
  userId?: string
  archetype: string
  outcome: string
  referenceImageUrl?: string
  totalBeats?: number
}): Promise<StorySession> {
  return (await getMode()) === 'nocodb'
    ? v3.createSessionV3(session)
    : local.createSessionLocal(session)
}

export async function getSession(sessionId: string): Promise<StorySession | null> {
  return (await getMode()) === 'nocodb' ? v3.getSessionV3(sessionId) : local.getSessionLocal(sessionId)
}

export async function updateSession(
  sessionId: string,
  updates: Partial<{ status: 'active' | 'completed' | 'abandoned'; currentBeat: number; storyData: string }>
): Promise<StorySession> {
  return (await getMode()) === 'nocodb'
    ? v3.updateSessionV3(sessionId, updates)
    : local.updateSessionLocal(sessionId, updates)
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
  return (await getMode()) === 'nocodb' ? v3.createBeatV3(beat) : local.createBeatLocal(beat)
}

export async function getBeatsForSession(sessionId: string): Promise<StoryBeatRecord[]> {
  return (await getMode()) === 'nocodb'
    ? v3.getBeatsForSessionV3(sessionId)
    : local.getBeatsForSessionLocal(sessionId)
}

export async function updateBeat(
  beatId: string,
  updates: Partial<{
    description: string
    generatedIdea: string
    selectedBranchId: string
    keyframesJson: string
    status: 'pending' | 'generating' | 'ready' | 'locked' | 'skeleton'
  }>
): Promise<StoryBeatRecord> {
  return (await getMode()) === 'nocodb' ? v3.updateBeatV3(beatId, updates) : local.updateBeatLocal(beatId, updates)
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
  return (await getMode()) === 'nocodb' ? v3.createBranchV3(branch) : local.createBranchLocal(branch)
}

export async function getBranchesForBeat(beatId: string): Promise<BranchRecord[]> {
  return (await getMode()) === 'nocodb'
    ? v3.getBranchesForBeatV3(beatId)
    : local.getBranchesForBeatLocal(beatId)
}

export async function selectBranch(branchId: string, beatId: string): Promise<void> {
  return (await getMode()) === 'nocodb'
    ? v3.selectBranchV3(branchId, beatId)
    : local.selectBranchLocal(branchId, beatId)
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
  return (await getMode()) === 'nocodb'
    ? v3.createKeyframeV3(keyframe)
    : local.createKeyframeLocal(keyframe)
}

export async function getKeyframesForBeat(beatId: string, branchId?: string): Promise<KeyframeRecord[]> {
  return (await getMode()) === 'nocodb'
    ? v3.getKeyframesForBeatV3(beatId, branchId)
    : local.getKeyframesForBeatLocal(beatId, branchId)
}

export async function updateKeyframe(
  keyframeId: string,
  updates: Partial<{ imageUrl: string; status: 'pending' | 'generating' | 'ready' | 'error' }>
): Promise<KeyframeRecord> {
  return (await getMode()) === 'nocodb'
    ? v3.updateKeyframeV3(keyframeId, updates)
    : local.updateKeyframeLocal(keyframeId, updates)
}

export async function bulkCreateKeyframes(
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
  return (await getMode()) === 'nocodb'
    ? v3.bulkCreateKeyframesV3(keyframes)
    : local.bulkCreateKeyframesLocal(keyframes)
}

export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function generateBeatId(sessionId: string, beatIndex: number): string {
  return `${sessionId}-beat-${beatIndex}`
}

export function generateBranchId(beatId: string, branchIndex: number): string {
  return `${beatId}-branch-${String.fromCharCode(65 + branchIndex)}`
}

export function generateKeyframeId(beatId: string, branchId: string | null, frameIndex: number): string {
  const base = branchId ? `${branchId}` : beatId
  return `${base}-kf-${frameIndex}`
}

const NEXTCLOUD_URL = process.env.NEXTCLOUD_URL || 'https://cloud.v1su4.dev'
const NEXTCLOUD_USER = process.env.NEXTCLOUD_USER || 'admin'
const NEXTCLOUD_APP_PASSWORD = process.env.NEXTCLOUD_APP_PASSWORD || ''

export function getNextcloudPath(sessionId: string, beatId: string, frameIndex: number, branchId?: string): string {
  const p = branchId
    ? `storyception/${sessionId}/${beatId}/${branchId}/keyframe-${frameIndex}.png`
    : `storyception/${sessionId}/${beatId}/keyframe-${frameIndex}.png`
  return p
}

export const nextcloudConfig = {
  url: NEXTCLOUD_URL,
  user: NEXTCLOUD_USER,
  appPassword: NEXTCLOUD_APP_PASSWORD,
  webdavUrl: `${NEXTCLOUD_URL}/remote.php/dav/files/${NEXTCLOUD_USER}`,
  shareApiUrl: `${NEXTCLOUD_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares`,
}
