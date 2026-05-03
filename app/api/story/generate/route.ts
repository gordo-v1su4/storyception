/**
 * Story Generation API Route
 * 
 * Calls Anthropic Claude Sonnet 4.6 to generate story beats and keyframe prompts
 * Saves generated story to NocoDB for persistence
 */

import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import {
  createSession,
  updateSession,
  createBeat,
  bulkCreateKeyframes,
  generateSessionId,
  generateBeatId,
  generateKeyframeId,
} from '@/lib/nocodb'
import {
  HERO_JOURNEY_BEATS,
  SAVE_THE_CAT_BEATS,
  STORY_CIRCLE_BEATS,
  THREE_ACT_BEATS,
  SEVEN_POINT_BEATS,
  LESTER_DENT_BEATS,
  SONG_ARC_BEATS,
  PERFORMANCE_MV_BEATS,
  VISUAL_CONCEPT_MV_BEATS,
  PROBLEM_SOLUTION_BEATS,
  LIFESTYLE_SPOT_BEATS,
  MINI_STORY_SPOT_BEATS,
} from '@/lib/data'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const FAL_KEY = process.env.FAL_KEY
const FAL_API_URL = 'https://fal.run/fal-ai/nano-banana-pro/edit'
const NOCODB_BASE_URL = process.env.NOCODB_BASE_URL || 'https://nocodb.v1su4.dev'
const NOCODB_API_TOKEN = process.env.NOCODB_API_TOKEN || ''
const NEXTCLOUD_BASE_URL = process.env.NEXTCLOUD_BASE_URL || 'https://cloud.v1su4.dev'
const NEXTCLOUD_USERNAME = process.env.NEXTCLOUD_USERNAME || 'admin'
const NEXTCLOUD_APP_PASSWORD = process.env.NEXTCLOUD_APP_PASSWORD || ''
const NEXTCLOUD_UPLOAD_PATH = process.env.NEXTCLOUD_UPLOAD_PATH || '/Storyception'
const NOCODB_TABLE_BEATS = process.env.NOCODB_TABLE_BEATS || 'may145m0gc24nmu'
const NOCODB_TABLE_KEYFRAMES = process.env.NOCODB_TABLE_KEYFRAMES || 'mc5xw2syf1fxek8'

const NEXTCLOUD_WEBDAV_URL = `${NEXTCLOUD_BASE_URL}/remote.php/dav/files/${NEXTCLOUD_USERNAME}`
const NEXTCLOUD_SHARE_API_URL = `${NEXTCLOUD_BASE_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares`

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Grid prompt moved to /api/images/generate - this function is kept for reference only
function buildGridPrompt(beatLabel: string, beatDescription: string): string {
  return `PHOTOREAL cinematic 3x3 grid storyboard for: ${beatLabel} - ${beatDescription}`
}

async function nextcloudCreateFolder(path: string) {
  const auth = Buffer.from(`${NEXTCLOUD_USERNAME}:${NEXTCLOUD_APP_PASSWORD}`).toString('base64')
  const parts = path.split('/').filter(Boolean)
  let currentPath = ''
  for (const part of parts) {
    currentPath += `/${part}`
    try {
      await fetch(`${NEXTCLOUD_WEBDAV_URL}${currentPath}/`, {
        method: 'MKCOL',
        headers: { 'Authorization': `Basic ${auth}` },
      })
    } catch {
      // Folder may already exist
    }
  }
}

async function nextcloudUpload(imageBuffer: Buffer, remotePath: string): Promise<boolean> {
  const auth = Buffer.from(`${NEXTCLOUD_USERNAME}:${NEXTCLOUD_APP_PASSWORD}`).toString('base64')
  const folderPath = remotePath.substring(0, remotePath.lastIndexOf('/'))
  await nextcloudCreateFolder(folderPath)
  const response = await fetch(`${NEXTCLOUD_WEBDAV_URL}/${remotePath}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'image/png',
    },
    body: imageBuffer as unknown as BodyInit,
  })
  return response.ok || response.status === 201 || response.status === 204
}

async function nextcloudCreateShare(path: string): Promise<string | null> {
  const auth = Buffer.from(`${NEXTCLOUD_USERNAME}:${NEXTCLOUD_APP_PASSWORD}`).toString('base64')
  const response = await fetch(NEXTCLOUD_SHARE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'OCS-APIRequest': 'true',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      path: `/${path}`,
      shareType: '3',
      permissions: '1',
    }),
  })
  if (response.ok) {
    const text = await response.text()
    const urlMatch = text.match(/<url>([^<]+)<\/url>/)
    if (urlMatch) {
      return urlMatch[1].replace('http://', 'https://') + '/download'
    }
  }
  return null
}

async function generateGridWithFal(referenceImageUrl: string, prompt: string): Promise<Buffer | null> {
  const response = await fetch(FAL_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_urls: [referenceImageUrl],
      aspect_ratio: '16:9',
      resolution: '4K',
      num_images: 1,
      output_format: 'png',
      sync_mode: true,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`fal.ai error: ${response.status} - ${errorText}`)
    return null
  }

  const data = await response.json()
  if (data.images && data.images.length > 0) {
    const imageUrl = data.images[0].url
    const imgResponse = await fetch(imageUrl)
    const arrayBuffer = await imgResponse.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  return null
}

async function generateThumbnail(imageBuffer: Buffer, maxWidth: number = 200): Promise<Buffer> {
  return await sharp(imageBuffer)
    .resize(maxWidth, null, { fit: 'inside' })
    .png({ quality: 80 })
    .toBuffer()
}

async function sliceGridIntoKeyframes(gridBuffer: Buffer): Promise<Buffer[]> {
  const keyframes: Buffer[] = []
  const metadata = await sharp(gridBuffer).metadata()
  const width = metadata.width || 3840
  const height = metadata.height || 2160
  const cellWidth = Math.floor(width / 3)
  const cellHeight = Math.floor(height / 3)

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const left = col * cellWidth
      const top = row * cellHeight
      const cellBuffer = await sharp(gridBuffer)
        .extract({ left, top, width: cellWidth, height: cellHeight })
        .png()
        .toBuffer()
      keyframes.push(cellBuffer)
    }
  }

  return keyframes
}

async function updateKeyframeImageRecord(
  keyframeId: string,
  imageUrl: string | null,
  thumbnailUrl: string | null
): Promise<void> {
  if (!NOCODB_API_TOKEN) return
  const findResponse = await fetch(
    `${NOCODB_BASE_URL}/api/v2/tables/${NOCODB_TABLE_KEYFRAMES}/records?where=(Keyframe ID,eq,${encodeURIComponent(keyframeId)})`,
    { headers: { 'xc-token': NOCODB_API_TOKEN } }
  )
  if (!findResponse.ok) return
  const findData = await findResponse.json()
  const record = findData.list?.[0]
  if (!record?.Id) return

  const thumbnailAttachment = thumbnailUrl ? [{
    url: thumbnailUrl,
    title: `thumb-${keyframeId}.png`,
    mimetype: 'image/png',
  }] : null

  await fetch(`${NOCODB_BASE_URL}/api/v2/tables/${NOCODB_TABLE_KEYFRAMES}/records`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'xc-token': NOCODB_API_TOKEN,
    },
    body: JSON.stringify([{
      Id: record.Id,
      'Image URL': imageUrl,
      'Thumbnail': thumbnailAttachment,
      'Status': imageUrl ? 'ready' : 'pending',
    }]),
  })
}

async function updateBeatKeyframesJson(beatId: string, gridUrl: string | null, keyframes: string[]) {
  if (!NOCODB_API_TOKEN) return
  const findResponse = await fetch(
    `${NOCODB_BASE_URL}/api/v2/tables/${NOCODB_TABLE_BEATS}/records?where=(Beat ID,eq,${encodeURIComponent(beatId)})`,
    { headers: { 'xc-token': NOCODB_API_TOKEN } }
  )
  if (!findResponse.ok) return
  const findData = await findResponse.json()
  const record = findData.list?.[0]
  if (!record?.Id) return

  await fetch(`${NOCODB_BASE_URL}/api/v2/tables/${NOCODB_TABLE_BEATS}/records`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'xc-token': NOCODB_API_TOKEN,
    },
    body: JSON.stringify([{
      Id: record.Id,
      'Keyframes (JSON)': JSON.stringify({ gridUrl, keyframes }),
      'Status': keyframes.length > 0 ? 'ready' : 'pending',
    }]),
  })
}

// Beat structures by archetype (indices match `archetypes` in lib/data)
const BEAT_STRUCTURES: Record<number, { id: string; label: string; desc: string }[]> = {
  0: HERO_JOURNEY_BEATS,
  1: SAVE_THE_CAT_BEATS,
  2: STORY_CIRCLE_BEATS,
  3: THREE_ACT_BEATS,
  4: SEVEN_POINT_BEATS,
  5: LESTER_DENT_BEATS,
  6: SONG_ARC_BEATS,
  7: PERFORMANCE_MV_BEATS,
  8: VISUAL_CONCEPT_MV_BEATS,
  9: PROBLEM_SOLUTION_BEATS,
  10: LIFESTYLE_SPOT_BEATS,
  11: MINI_STORY_SPOT_BEATS,
}

export interface StoryGenerationRequest {
  archetypeIndex: number
  archetypeName: string
  outcomeIndex?: number
  outcomeName: string
  referenceImages?: string[]
  totalDuration?: number
}

export interface GeneratedBeat {
  id: string
  label: string
  scene_description: string
  duration_seconds: number
  keyframe_prompts: string[]
  index: number
  status: string
  gridImageUrl: string | null
  keyframeUrls: string[]
}

export interface StoryGenerationResponse {
  success: boolean
  storyId: string
  title: string
  logline: string
  storySeed: string
  archetype: string
  outcome: string
  beatCount: number
  beats: GeneratedBeat[]
  generatedAt: string
}

export async function POST(request: NextRequest) {
  try {
    const body: StoryGenerationRequest = await request.json()

    // Validate
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      )
    }

    const archetypeIndex = body.archetypeIndex ?? 1
    const archetypeName = body.archetypeName || 'Save the Cat'
    const outcomeName = body.outcomeName || 'Happy Ending'
    const totalDuration = body.totalDuration || 90

    const beats = BEAT_STRUCTURES[archetypeIndex] || BEAT_STRUCTURES[1]

    // Build prompt — only generate first 2 beats + story seed for progressive generation
    const INITIAL_BEAT_COUNT = 2
    const initialBeats = beats.slice(0, INITIAL_BEAT_COUNT)
    const remainingBeats = beats.slice(INITIAL_BEAT_COUNT)

    const prompt = `You are an expert screenwriter and storyboard artist.

Create the OPENING of an interactive story following the ${archetypeName} structure (${beats.length} total beats).

Story Structure: ${archetypeName}
Desired Outcome: ${outcomeName}
Total Duration: ${totalDuration} seconds

Generate ONLY the first ${INITIAL_BEAT_COUNT} beats with full detail. The remaining beats will be generated progressively as the player makes choices.

For each beat, provide:
1. A vivid scene description (2-3 sentences)
2. Exactly 9 keyframe prompts for image generation (arranged in a 3x3 grid)

The 9 keyframe prompts should follow this shot progression:
- KF1: Wide establishing shot
- KF2: Medium shot introducing characters
- KF3: Close-up on protagonist's face/emotion
- KF4: Action or movement shot
- KF5: Central dramatic moment (center of grid)
- KF6: Reaction shot
- KF7: Environmental detail or symbol
- KF8: Character interaction
- KF9: Closing moment of the beat

Each keyframe prompt must be a detailed, cinematic description (30-50 words) suitable for AI image generation.

The first ${INITIAL_BEAT_COUNT} beats to generate:
${initialBeats.map((b, i) => `${i + 1}. ${b.label}: ${b.desc}`).join('\n')}

The REMAINING beats (for context only — do NOT generate these yet):
${remainingBeats.map((b, i) => `${INITIAL_BEAT_COUNT + i + 1}. ${b.label}: ${b.desc}`).join('\n')}

Also provide a "story_seed" — a 2-3 sentence narrative foundation describing the protagonist, their world, the central conflict, and the tone. This seed will be used as context when generating future beats based on player choices.

RESPOND IN THIS EXACT JSON FORMAT:
{
  "story_title": "Generated Story Title",
  "story_logline": "One sentence story summary",
  "story_seed": "2-3 sentence narrative seed describing protagonist, world, conflict, and tone...",
  "beats": [
    {
      "id": "beatId",
      "label": "Beat Label",
      "scene_description": "Vivid scene description...",
      "duration_seconds": 6,
      "keyframe_prompts": ["KF1: Wide shot prompt...", "KF2: ...", ... 9 total]
    }
  ]
}

Generate a compelling ${outcomeName.toLowerCase()} story opening now.`

    // Call Anthropic Claude API with retry on rate limit
    const maxAttempts = 3
    let anthropicResponse: Response | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      anthropicResponse = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: 'You are an expert screenwriter and storyboard artist. Always respond with valid JSON only, no markdown code blocks or extra text. Output raw JSON.',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.8,
        }),
      })

      if (anthropicResponse.ok) break

      const errorText = await anthropicResponse.text()
      console.error(`Anthropic API Error (attempt ${attempt}):`, errorText)

      if (anthropicResponse.status === 429 && attempt < maxAttempts) {
        await sleep(1000 * attempt)
        continue
      }

      return NextResponse.json(
        { success: false, error: `Anthropic API error: ${anthropicResponse.status}` },
        { status: 500 }
      )
    }

    if (!anthropicResponse) {
      return NextResponse.json(
        { success: false, error: 'Anthropic API error: no response' },
        { status: 500 }
      )
    }

    const anthropicData = await anthropicResponse.json()

    // Extract text from Anthropic response (content is an array of blocks)
    const textContent = anthropicData.content
      ?.filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('') || '{}'

    let storyData
    try {
      storyData = JSON.parse(textContent)
    } catch {
      // Try extracting from markdown code block
      const jsonMatch = textContent.match(/```json\n?([\s\S]*?)\n?```/)
      if (jsonMatch) {
        storyData = JSON.parse(jsonMatch[1])
      } else {
        console.error('Failed to parse Anthropic response:', textContent.substring(0, 500))
        return NextResponse.json(
          { success: false, error: 'Failed to parse story response' },
          { status: 500 }
        )
      }
    }

    // Generate session ID
    const sessionId = generateSessionId()
    const storySeed = storyData.story_seed || ''

    // Build the full beat list: generated beats (first 2) + skeleton beats (remaining)
    const generatedBeats = (storyData.beats || []) as Array<Partial<GeneratedBeat>>
    const allBeats: GeneratedBeat[] = beats.map((beatDef, index) => {
      const generated = generatedBeats[index]
      if (generated && index < INITIAL_BEAT_COUNT) {
        // First 2 beats: full content from Claude
        return {
          ...generated,
          id: generateBeatId(sessionId, index),
          label: generated.label || beatDef.label,
          scene_description: generated.scene_description || '',
          duration_seconds: generated.duration_seconds || 6,
          keyframe_prompts: generated.keyframe_prompts || [],
          index,
          status: 'pending',
          gridImageUrl: null,
          keyframeUrls: [],
        }
      } else {
        // Remaining beats: skeleton (label only, no content)
        return {
          id: generateBeatId(sessionId, index),
          label: beatDef.label,
          scene_description: '',
          duration_seconds: 6,
          keyframe_prompts: [],
          index,
          status: 'skeleton',
          gridImageUrl: null,
          keyframeUrls: [],
        }
      }
    })

    // === SAVE TO NOCODB ===
    try {
      // Create session record
      await createSession({
        sessionId,
        archetype: archetypeName,
        outcome: outcomeName,
        referenceImageUrl: body.referenceImages?.[0] || undefined,
        totalBeats: allBeats.length,
      })

      // Store storySeed and outcomeName in session data for reload
      await updateSession(sessionId, {
        storyData: JSON.stringify({ storySeed, outcomeName }),
      })

      // Create beat records — full records for first 2, skeletons for rest
      for (const beat of allBeats) {
        const beatWeight = 1 / allBeats.length
        await createBeat({
          beatId: beat.id,
          sessionId,
          beatIndex: beat.index,
          beatLabel: beat.label,
          description: beat.scene_description || undefined,
          duration: `${beat.duration_seconds || 6}s`,
          percentOfTotal: Math.round(beatWeight * 100),
        })

        // Only create keyframe records for generated beats (not skeletons)
        if (beat.status !== 'skeleton' && beat.keyframe_prompts && beat.keyframe_prompts.length > 0) {
          const keyframes = beat.keyframe_prompts.slice(0, 9).map((prompt: string, idx: number) => ({
            keyframeId: generateKeyframeId(beat.id, null, idx + 1),
            sessionId,
            beatId: beat.id,
            frameIndex: idx + 1,
            row: Math.floor(idx / 3) + 1,
            col: (idx % 3) + 1,
            prompt: prompt,
          }))

          await bulkCreateKeyframes(keyframes)
        }
      }

      console.log(`✅ Story saved: ${sessionId} — ${INITIAL_BEAT_COUNT} generated beats + ${allBeats.length - INITIAL_BEAT_COUNT} skeletons`)
    } catch (nocoError) {
      console.error('⚠️ Failed to save to NocoDB (continuing anyway):', nocoError)
    }

    // Image generation is on-demand via /api/images/generate
    // Progressive beat content generated via /api/story/beat

    const response: StoryGenerationResponse = {
      success: true,
      storyId: sessionId,
      title: storyData.story_title || 'Untitled Story',
      logline: storyData.story_logline || '',
      storySeed,
      archetype: archetypeName,
      outcome: outcomeName,
      beatCount: allBeats.length,
      beats: allBeats,
      generatedAt: new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Story Generation Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Story generation failed',
      },
      { status: 500 }
    )
  }
}

// GET - API info
export async function GET() {
  return NextResponse.json({
    message: 'Story Generation API (Anthropic Claude Sonnet 4.6)',
    usage: 'POST with archetypeIndex, archetypeName, outcomeName',
    archetypes: [
      { index: 0, name: "Hero's Journey", beats: 12 },
      { index: 1, name: 'Save the Cat', beats: 15 },
      { index: 2, name: 'Story Circle', beats: 8 },
      { index: 3, name: 'Three-Act', beats: 9 },
      { index: 4, name: 'Seven-Point', beats: 7 },
      { index: 5, name: 'Lester Dent', beats: 19 },
      { index: 6, name: 'Song Arc', beats: 8 },
      { index: 7, name: 'Performance MV', beats: 6 },
      { index: 8, name: 'Visual Concept', beats: 7 },
      { index: 9, name: 'Problem → Solution', beats: 6 },
      { index: 10, name: 'Lifestyle', beats: 6 },
      { index: 11, name: 'Mini-Story', beats: 7 },
    ],
    outcomes: ['Happy Ending', 'Tragedy', 'Redemption', 'Ambiguous'],
  })
}
