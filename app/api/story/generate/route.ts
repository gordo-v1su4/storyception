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
  createBeat, 
  bulkCreateKeyframes,
  generateSessionId, 
  generateBeatId,
  generateKeyframeId
} from '@/lib/nocodb'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const FAL_KEY = process.env.FAL_KEY
const FAL_API_URL = 'https://fal.run/fal-ai/nano-banana-pro/edit'
const NOCODB_BASE_URL = process.env.NOCODB_BASE_URL || 'https://nocodb.v1su4.com'
const NOCODB_API_TOKEN = process.env.NOCODB_API_TOKEN || ''
const NEXTCLOUD_BASE_URL = process.env.NEXTCLOUD_BASE_URL || 'https://nextcloud.v1su4.com'
const NEXTCLOUD_USERNAME = process.env.NEXTCLOUD_USERNAME || 'admin'
const NEXTCLOUD_APP_PASSWORD = process.env.NEXTCLOUD_APP_PASSWORD || ''
const NEXTCLOUD_UPLOAD_PATH = process.env.NEXTCLOUD_UPLOAD_PATH || '/Storyception'
const NOCODB_TABLE_BEATS = process.env.NOCODB_TABLE_BEATS || 'may145m0gc24nmu'
const NOCODB_TABLE_KEYFRAMES = process.env.NOCODB_TABLE_KEYFRAMES || 'mc5xw2syf1fxek8'

const NEXTCLOUD_WEBDAV_URL = `${NEXTCLOUD_BASE_URL}/remote.php/dav/files/${NEXTCLOUD_USERNAME}`
const NEXTCLOUD_SHARE_API_URL = `${NEXTCLOUD_BASE_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares`

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function buildGridPrompt(beatLabel: string, beatDescription: string): string {
  return `You are an award-winning trailer director and storyboard artist.

TASK: Transform the reference image into a cinematic 3x3 grid storyboard.

SCENE: ${beatLabel}
DESCRIPTION: ${beatDescription}
STYLE: cinematic, photoreal, film quality, dramatic lighting

OUTPUT: Generate ONE single image containing a 3×3 grid (9 panels total).

CRITICAL RULES:
- The SAME character from the reference must appear in all 9 panels
- Maintain strict continuity: same person, same wardrobe, same environment, same lighting
- Only change: camera angle, framing, action, expression between panels
- Do NOT add text, labels, or watermarks on the image
- Photoreal quality, cinematic color grade consistent across all panels

SHOT PROGRESSION (reading left-to-right, top-to-bottom):
Panel 1: Extreme wide establishing shot - full environment visible
Panel 2: Wide shot - character in environment context
Panel 3: Medium-long shot - character approaching or moving
Panel 4: Medium shot - character interaction or key action
Panel 5: Medium close-up - emotional peak moment (center of grid)
Panel 6: Close-up - intense facial expression or reaction
Panel 7: Extreme close-up - detail shot (eyes, hands, object)
Panel 8: Low angle power shot - dramatic perspective
Panel 9: Wide closing shot - resolution or transition moment

REQUIREMENTS:
- One cohesive image with all 9 shots in a 3x3 grid layout
- Thin black borders between panels
- 16:9 aspect ratio for the full grid
- NO TEXT OR LABELS - pure visual storytelling
- Cinematic lighting and color grading throughout`
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

// Beat structures by archetype
const BEAT_STRUCTURES: Record<number, { id: string; label: string; desc: string }[]> = {
  0: [ // Hero's Journey (12 beats)
    { id: 'ordinaryWorld', label: '1. THE ORDINARY WORLD', desc: "The hero's normal life before adventure" },
    { id: 'callToAdventure', label: '2. THE CALL TO ADVENTURE', desc: 'An inciting incident disrupts comfort' },
    { id: 'refusal', label: '3. REFUSAL OF THE CALL', desc: 'The hero hesitates or resists' },
    { id: 'meetingMentor', label: '4. MEETING THE MENTOR', desc: 'A guide offers wisdom or tools' },
    { id: 'crossingThreshold', label: '5. CROSSING THE THRESHOLD', desc: 'Hero commits and enters the unknown' },
    { id: 'testsAllies', label: '6. TESTS, ALLIES, ENEMIES', desc: 'Challenges, friends, and foes appear' },
    { id: 'approach', label: '7. APPROACH TO THE CAVE', desc: 'Nearing the goal with rising danger' },
    { id: 'ordeal', label: '8. THE ORDEAL', desc: 'Critical confrontation with deepest fears' },
    { id: 'reward', label: '9. REWARD (SEIZING THE SWORD)', desc: 'Victory and earning the boon' },
    { id: 'roadBack', label: '10. THE ROAD BACK', desc: 'Journey home begins but not over' },
    { id: 'resurrection', label: '11. RESURRECTION', desc: 'Final climactic challenge' },
    { id: 'returnElixir', label: '12. RETURN WITH THE ELIXIR', desc: 'Hero returns transformed' },
  ],
  1: [ // Save the Cat (15 beats)
    { id: 'openingImage', label: '1. OPENING IMAGE', desc: 'Snapshot setting tone and protagonist' },
    { id: 'setup', label: '2. SETUP', desc: 'World, relationships, and stakes established' },
    { id: 'themeStated', label: '3. THEME STATED', desc: "Story's deeper message hinted" },
    { id: 'catalyst', label: '4. CATALYST', desc: 'Inciting incident kicks story into motion' },
    { id: 'debate', label: '5. DEBATE', desc: 'Protagonist hesitates or questions' },
    { id: 'breakIntoTwo', label: '6. BREAK INTO TWO', desc: 'Hero commits to the goal, entering Act II' },
    { id: 'bStory', label: '7. B STORY', desc: 'Subplot emerges (romance, friendship)' },
    { id: 'funAndGames', label: '8. FUN AND GAMES', desc: 'Promise of premise explored' },
    { id: 'midpoint', label: '9. MIDPOINT', desc: "Major twist changes story's trajectory" },
    { id: 'badGuysCloseIn', label: '10. BAD GUYS CLOSE IN', desc: 'Tension ramps, obstacles surround' },
    { id: 'allIsLost', label: '11. ALL IS LOST', desc: 'Crushing setback, deepest fears confronted' },
    { id: 'darkNight', label: '12. DARK NIGHT OF THE SOUL', desc: 'Rock bottom, questioning everything' },
    { id: 'breakIntoThree', label: '13. BREAK INTO THREE', desc: 'New insight sparks path forward' },
    { id: 'finale', label: '14. FINALE', desc: 'Climax using everything learned' },
    { id: 'finalImage', label: '15. FINAL IMAGE', desc: 'Closing snapshot showing transformation' },
  ],
  2: [ // Story Circle (8 beats)
    { id: 'you', label: '1. YOU (ZONE OF COMFORT)', desc: 'Character in mundane everyday life' },
    { id: 'need', label: '2. NEED (WANT SOMETHING)', desc: 'Core desire compels action' },
    { id: 'go', label: '3. GO (ENTER UNFAMILIAR)', desc: 'Crosses threshold to pursue want' },
    { id: 'search', label: '4. SEARCH (ADAPT)', desc: 'Acquires new skills to survive' },
    { id: 'find', label: '5. FIND (GET WHAT THEY WANTED)', desc: 'Goal achieved at significant cost' },
    { id: 'take', label: '6. TAKE (PAY HEAVY PRICE)', desc: 'Victory followed by losses' },
    { id: 'return', label: '7. RETURN (FAMILIAR SITUATION)', desc: 'Goes back to where they started' },
    { id: 'change', label: '8. CHANGE (HAVING CHANGED)', desc: 'Character has grown, lessons remain' },
  ],
  3: [ // Three-Act (9 beats)
    { id: 'exposition', label: '1. EXPOSITION', desc: "Protagonist's ordinary world" },
    { id: 'incitingIncident', label: '2. INCITING INCIDENT', desc: 'Event disrupts ordinary world' },
    { id: 'plotPoint1', label: '3. PLOT POINT 1', desc: 'Commits to conflict, enters Act II' },
    { id: 'risingAction', label: '4. RISING ACTION', desc: 'Escalating challenges, raised stakes' },
    { id: 'midpoint', label: '5. MIDPOINT', desc: 'Major turning point' },
    { id: 'plotPoint2', label: '6. PLOT POINT 2', desc: 'Major setback, questioning success' },
    { id: 'preClimax', label: '7. PRE-CLIMAX', desc: 'Regroups for final confrontation' },
    { id: 'climax', label: '8. CLIMAX', desc: 'Ultimate showdown, conflict resolved' },
    { id: 'denouement', label: '9. DÉNOUEMENT', desc: 'Loose ends tied, new status quo' },
  ],
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

    // Build prompt
    const prompt = `You are an expert screenwriter and storyboard artist.

Generate a cohesive story following the ${archetypeName} structure with ${beats.length} beats.

Story Structure: ${archetypeName}
Desired Outcome: ${outcomeName}
Total Duration: ${totalDuration} seconds

For EACH beat, provide:
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

Each keyframe prompt must be a detailed, cinematic description (30-50 words) suitable for AI image generation. Include: camera angle, lighting mood, character actions, atmospheric details.

The beats to fill are:
${beats.map((b, i) => `${i + 1}. ${b.label}: ${b.desc}`).join('\n')}

RESPOND IN THIS EXACT JSON FORMAT:
{
  "story_title": "Generated Story Title",
  "story_logline": "One sentence story summary",
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

Generate a compelling ${outcomeName.toLowerCase()} story now.`

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
          max_tokens: 8192,
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

    // Enrich beats with IDs
    const enrichedBeats: GeneratedBeat[] = (storyData.beats || []).map(
      (beat: Partial<GeneratedBeat>, index: number) => ({
        ...beat,
        id: generateBeatId(sessionId, index),
        index,
        status: 'pending',
        gridImageUrl: null,
        keyframeUrls: [],
      })
    )

    // === SAVE TO NOCODB ===
    try {
      // Create session record
      await createSession({
        sessionId,
        archetype: archetypeName,
        outcome: outcomeName,
        referenceImageUrl: body.referenceImages?.[0] || undefined,
        totalBeats: enrichedBeats.length,
      })

      // Create beat records and keyframe records
      for (const beat of enrichedBeats) {
        const beatWeight = 1 / enrichedBeats.length // Simple equal distribution for now
        await createBeat({
          beatId: beat.id,
          sessionId,
          beatIndex: beat.index,
          beatLabel: beat.label,
          description: beat.scene_description,
          duration: `${beat.duration_seconds || 6}s`,
          percentOfTotal: Math.round(beatWeight * 100),
        })

        // Create keyframe records with prompts (9 per beat in a 3x3 grid)
        if (beat.keyframe_prompts && beat.keyframe_prompts.length > 0) {
          const keyframes = beat.keyframe_prompts.slice(0, 9).map((prompt: string, idx: number) => ({
            keyframeId: generateKeyframeId(beat.id, null, idx + 1),
            sessionId,
            beatId: beat.id,
            frameIndex: idx + 1,
            row: Math.floor(idx / 3) + 1,  // 1, 1, 1, 2, 2, 2, 3, 3, 3
            col: (idx % 3) + 1,            // 1, 2, 3, 1, 2, 3, 1, 2, 3
            prompt: prompt,
          }))
          
          await bulkCreateKeyframes(keyframes)
        }
      }

      console.log(`✅ Story saved to NocoDB: ${sessionId} with ${enrichedBeats.length} beats and keyframe prompts`)
    } catch (nocoError) {
      // Log but don't fail - story still works without persistence
      console.error('⚠️ Failed to save to NocoDB (continuing anyway):', nocoError)
    }

    // === OPTIONAL: GENERATE IMAGES FOR FIRST BEAT ===
    const referenceImageUrl = body.referenceImages?.[0]
    const canGenerateImages = Boolean(
      referenceImageUrl && FAL_KEY && NEXTCLOUD_APP_PASSWORD && NEXTCLOUD_USERNAME && NEXTCLOUD_BASE_URL
    )

    if (canGenerateImages && enrichedBeats.length > 0) {
      const firstBeat = enrichedBeats[0]
      try {
        const uploadRoot = (NEXTCLOUD_UPLOAD_PATH || '/Storyception')
          .replace(/^\/+/, '')
          .replace(/\/+$/, '') || 'Storyception'

        const gridPrompt = buildGridPrompt(firstBeat.label, firstBeat.scene_description)
        const gridBuffer = await generateGridWithFal(referenceImageUrl as string, gridPrompt)

        if (gridBuffer) {
          const gridPath = `${uploadRoot}/${sessionId}/${firstBeat.id}/grid-4k.png`
          const gridUploaded = await nextcloudUpload(gridBuffer, gridPath)
          const gridShareUrl = gridUploaded ? await nextcloudCreateShare(gridPath) : null

          const keyframeBuffers = await sliceGridIntoKeyframes(gridBuffer)
          const keyframeUrls: string[] = []
          const thumbnailUrls: string[] = []

          for (let i = 0; i < keyframeBuffers.length; i++) {
            const keyframePath = `${uploadRoot}/${sessionId}/${firstBeat.id}/keyframe-${i + 1}.png`
            const uploaded = await nextcloudUpload(keyframeBuffers[i], keyframePath)
            if (uploaded) {
              const shareUrl = await nextcloudCreateShare(keyframePath)
              if (shareUrl) keyframeUrls.push(shareUrl)
            }

            const thumbnailBuffer = await generateThumbnail(keyframeBuffers[i], 200)
            const thumbnailPath = `${uploadRoot}/${sessionId}/${firstBeat.id}/thumb-${i + 1}.png`
            const thumbUploaded = await nextcloudUpload(thumbnailBuffer, thumbnailPath)
            if (thumbUploaded) {
              const thumbShareUrl = await nextcloudCreateShare(thumbnailPath)
              if (thumbShareUrl) thumbnailUrls.push(thumbShareUrl)
            }
          }

          for (let i = 0; i < keyframeBuffers.length; i++) {
            const keyframeId = generateKeyframeId(firstBeat.id, null, i + 1)
            await updateKeyframeImageRecord(
              keyframeId,
              keyframeUrls[i] || null,
              thumbnailUrls[i] || null
            )
          }

          await updateBeatKeyframesJson(firstBeat.id, gridShareUrl, keyframeUrls)

          firstBeat.gridImageUrl = gridShareUrl
          firstBeat.keyframeUrls = keyframeUrls
        }
      } catch (imageError) {
        console.error('⚠️ Image generation failed (continuing anyway):', imageError)
      }
    }

    const response: StoryGenerationResponse = {
      success: true,
      storyId: sessionId,
      title: storyData.story_title || 'Untitled Story',
      logline: storyData.story_logline || '',
      archetype: archetypeName,
      outcome: outcomeName,
      beatCount: enrichedBeats.length,
      beats: enrichedBeats,
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
    ],
    outcomes: ['Happy Ending', 'Tragedy', 'Redemption', 'Ambiguous'],
  })
}
