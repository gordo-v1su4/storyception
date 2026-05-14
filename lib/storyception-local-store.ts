/**
 * Local JSON persistence (same field names as `lib/storyception-schema.ts`).
 */

import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

import type {
  BranchRecord,
  CharacterRecord,
  KeyframeRecord,
  StoryBeatRecord,
  StorySession,
} from './storyception-schema'
import { referenceImageUrlForPersistence } from './reference-image-persist'

const STORE_PATH =
  process.env.STORYCEPTION_LOCAL_DB_PATH ||
  path.join(process.cwd(), '.data', 'storyception-store.json')

type StoreShape = {
  nextId: number
  sessions: Record<string, StorySession>
  beats: Record<string, StoryBeatRecord>
  branches: Record<string, BranchRecord>
  keyframes: Record<string, KeyframeRecord>
  characters: Record<string, CharacterRecord>
}

let writeChain: Promise<unknown> = Promise.resolve()

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn)
  writeChain = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

async function load(): Promise<StoreShape> {
  try {
    const raw = await readFile(STORE_PATH, 'utf8')
    const data = JSON.parse(raw) as StoreShape
    if (!data.sessions) data.sessions = {}
    if (!data.beats) data.beats = {}
    if (!data.branches) data.branches = {}
    if (!data.keyframes) data.keyframes = {}
    if (!data.characters) data.characters = {}
    if (typeof data.nextId !== 'number') data.nextId = 1
    return data
  } catch {
    return {
      nextId: 1,
      sessions: {},
      beats: {},
      branches: {},
      keyframes: {},
      characters: {},
    }
  }
}

async function save(data: StoreShape) {
  await mkdir(path.dirname(STORE_PATH), { recursive: true })
  await writeFile(STORE_PATH, JSON.stringify(data, null, 2), 'utf8')
}

function nextNc(data: StoreShape): number {
  const id = data.nextId
  data.nextId += 1
  return id
}

export async function createSessionLocal(session: {
  sessionId: string
  userId?: string
  archetype: string
  outcome: string
  referenceImageUrl?: string
  referenceImageBucket?: string
  referenceImageObjectKey?: string
  referenceStorageProvider?: string
  totalBeats?: number
}): Promise<StorySession> {
  return serialize(async () => {
    const data = await load()
    const now = new Date().toISOString()
    const row: StorySession = {
      session_id: session.sessionId,
      user_id: session.userId ?? null,
      archetype: session.archetype,
      outcome: session.outcome,
      reference_image_url: referenceImageUrlForPersistence(session.referenceImageUrl),
      reference_image_bucket: session.referenceImageBucket ?? null,
      reference_image_object_key: session.referenceImageObjectKey ?? null,
      reference_storage_provider: session.referenceStorageProvider ?? null,
      status: 'active',
      current_beat: 1,
      total_beats: session.totalBeats || 15,
      created_at: now,
      updated_at: now,
      nc_row_id: nextNc(data),
    }
    data.sessions[session.sessionId] = row
    await save(data)
    return row
  })
}

export async function getSessionLocal(sessionId: string): Promise<StorySession | null> {
  const data = await load()
  return data.sessions[sessionId] ?? null
}

export async function updateSessionLocal(
  sessionId: string,
  updates: Partial<{ status: StorySession['status']; currentBeat: number; storyData: string }>
): Promise<StorySession> {
  return serialize(async () => {
    const data = await load()
    const existing = data.sessions[sessionId]
    if (!existing) throw new Error(`Local store: session not found: ${sessionId}`)
    if (updates.status) existing.status = updates.status
    if (updates.currentBeat !== undefined) existing.current_beat = updates.currentBeat
    if (updates.storyData) existing.story_data_json = updates.storyData
    existing.updated_at = new Date().toISOString()
    await save(data)
    return existing
  })
}

export async function createBeatLocal(beat: {
  beatId: string
  sessionId: string
  beatIndex: number
  beatLabel: string
  description?: string
  duration: string
  percentOfTotal: number
}): Promise<StoryBeatRecord> {
  return serialize(async () => {
    const data = await load()
    const row: StoryBeatRecord = {
      beat_id: beat.beatId,
      session_id: beat.sessionId,
      beat_index: beat.beatIndex,
      beat_label: beat.beatLabel,
      description: beat.description ?? null,
      duration: beat.duration,
      percent_of_total: beat.percentOfTotal,
      status: 'pending',
      created_at: new Date().toISOString(),
      nc_row_id: nextNc(data),
    }
    data.beats[beat.beatId] = row
    await save(data)
    return row
  })
}

export async function getBeatsForSessionLocal(sessionId: string): Promise<StoryBeatRecord[]> {
  const data = await load()
  return Object.values(data.beats)
    .filter((b) => b.session_id === sessionId)
    .sort((a, b) => a.beat_index - b.beat_index)
}

export async function updateBeatLocal(
  beatId: string,
  updates: Partial<{
    description: string
    generatedIdea: string
    selectedBranchId: string
    keyframesJson: string
    status: StoryBeatRecord['status']
  }>
): Promise<StoryBeatRecord> {
  return serialize(async () => {
    const data = await load()
    const existing = data.beats[beatId]
    if (!existing) throw new Error(`Local store: beat not found: ${beatId}`)
    if (updates.description !== undefined) existing.description = updates.description
    if (updates.generatedIdea !== undefined) existing.generated_idea = updates.generatedIdea
    if (updates.selectedBranchId !== undefined) existing.selected_branch_id = updates.selectedBranchId
    if (updates.keyframesJson !== undefined) existing.keyframes_json = updates.keyframesJson
    if (updates.status !== undefined) existing.status = updates.status
    await save(data)
    return existing
  })
}

export async function createBranchLocal(branch: {
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
  return serialize(async () => {
    const data = await load()
    const row: BranchRecord = {
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
      nc_row_id: nextNc(data),
    }
    data.branches[branch.branchId] = row
    await save(data)
    return row
  })
}

export async function getBranchesForBeatLocal(beatId: string): Promise<BranchRecord[]> {
  const data = await load()
  return Object.values(data.branches)
    .filter((b) => b.beat_id === beatId)
    .sort((a, b) => a.branch_index - b.branch_index)
}

export async function selectBranchLocal(branchId: string, beatId: string): Promise<void> {
  return serialize(async () => {
    const data = await load()
    const branches = Object.values(data.branches).filter((b) => b.beat_id === beatId)
    for (const b of branches) {
      b.is_selected = b.branch_id === branchId
    }
    await save(data)
  })
}

export async function createKeyframeLocal(keyframe: {
  keyframeId: string
  sessionId: string
  beatId: string
  branchId?: string
  frameIndex: number
  row: number
  col: number
  prompt: string
  imageUrl?: string
  storageBucket?: string
  objectKey?: string
  storageProvider?: string
}): Promise<KeyframeRecord> {
  return serialize(async () => {
    const data = await load()
    const row: KeyframeRecord = {
      keyframe_id: keyframe.keyframeId,
      session_id: keyframe.sessionId,
      beat_id: keyframe.beatId,
      branch_id: keyframe.branchId ?? null,
      frame_index: keyframe.frameIndex,
      grid_row: keyframe.row,
      grid_col: keyframe.col,
      prompt: keyframe.prompt,
      image_url: keyframe.imageUrl || '',
      storage_bucket: keyframe.storageBucket ?? null,
      object_key: keyframe.objectKey ?? null,
      storage_provider: keyframe.storageProvider ?? null,
      status: 'pending',
      created_at: new Date().toISOString(),
      nc_row_id: nextNc(data),
    }
    data.keyframes[keyframe.keyframeId] = row
    await save(data)
    return row
  })
}

export async function getKeyframesForBeatLocal(beatId: string, branchId?: string): Promise<KeyframeRecord[]> {
  const data = await load()
  return Object.values(data.keyframes)
    .filter((k) => {
      if (k.beat_id !== beatId) return false
      if (branchId !== undefined) return k.branch_id === branchId
      return true
    })
    .sort((a, b) => a.frame_index - b.frame_index)
}

export async function updateKeyframeLocal(
  keyframeId: string,
  updates: Partial<{
    imageUrl: string
    storageBucket: string
    objectKey: string
    storageProvider: string
    status: KeyframeRecord['status']
  }>
): Promise<KeyframeRecord> {
  return serialize(async () => {
    const data = await load()
    const existing = data.keyframes[keyframeId]
    if (!existing) throw new Error(`Local store: keyframe not found: ${keyframeId}`)
    if (updates.imageUrl !== undefined) existing.image_url = updates.imageUrl
    if (updates.storageBucket !== undefined) existing.storage_bucket = updates.storageBucket
    if (updates.objectKey !== undefined) existing.object_key = updates.objectKey
    if (updates.storageProvider !== undefined) existing.storage_provider = updates.storageProvider
    if (updates.status !== undefined) existing.status = updates.status
    await save(data)
    return existing
  })
}

export async function createCharacterLocal(character: {
  characterId: string
  sessionId: string
  name: string
  kind: CharacterRecord['kind']
  descriptor?: string
  sourceImageUrl?: string
  sheetImageUrl?: string
  lookSheetImageUrl?: string
  lookLabel?: string
  megaPrompt?: string
}): Promise<CharacterRecord> {
  return serialize(async () => {
    const data = await load()
    const row: CharacterRecord = {
      character_id: character.characterId,
      session_id: character.sessionId,
      name: character.name,
      kind: character.kind,
      descriptor: character.descriptor ?? null,
      source_image_url: character.sourceImageUrl ?? null,
      sheet_image_url: character.sheetImageUrl ?? null,
      look_sheet_image_url: character.lookSheetImageUrl ?? null,
      look_label: character.lookLabel ?? 'Default',
      mega_prompt: character.megaPrompt ?? null,
      created_at: new Date().toISOString(),
      nc_row_id: nextNc(data),
    }
    data.characters[character.characterId] = row
    await save(data)
    return row
  })
}

export async function getCharactersForSessionLocal(
  sessionId: string
): Promise<CharacterRecord[]> {
  const data = await load()
  return Object.values(data.characters)
    .filter((c) => c.session_id === sessionId)
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
}

export async function updateCharacterLocal(
  characterId: string,
  updates: Partial<{
    name: string
    kind: CharacterRecord['kind']
    descriptor: string
    sourceImageUrl: string
    sheetImageUrl: string
    lookSheetImageUrl: string
    lookLabel: string
    megaPrompt: string
  }>
): Promise<CharacterRecord> {
  return serialize(async () => {
    const data = await load()
    const existing = data.characters[characterId]
    if (!existing) throw new Error(`Local store: character not found: ${characterId}`)
    if (updates.name !== undefined) existing.name = updates.name
    if (updates.kind !== undefined) existing.kind = updates.kind
    if (updates.descriptor !== undefined) existing.descriptor = updates.descriptor
    if (updates.sourceImageUrl !== undefined) existing.source_image_url = updates.sourceImageUrl
    if (updates.sheetImageUrl !== undefined) existing.sheet_image_url = updates.sheetImageUrl
    if (updates.lookSheetImageUrl !== undefined) existing.look_sheet_image_url = updates.lookSheetImageUrl
    if (updates.lookLabel !== undefined) existing.look_label = updates.lookLabel
    if (updates.megaPrompt !== undefined) existing.mega_prompt = updates.megaPrompt
    await save(data)
    return existing
  })
}

export async function bulkCreateKeyframesLocal(
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
  return serialize(async () => {
    const data = await load()
    const out: KeyframeRecord[] = []
    for (const kf of keyframes) {
      const row: KeyframeRecord = {
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
        nc_row_id: nextNc(data),
      }
      data.keyframes[kf.keyframeId] = row
      out.push(row)
    }
    await save(data)
    return out
  })
}
