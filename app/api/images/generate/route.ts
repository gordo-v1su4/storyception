/**
 * Per-Beat Image Generation API
 * 
 * Generates a 4K 3x3 grid for a single beat using fal.ai Nano Banana Pro,
 * slices into 9 keyframes, uploads to Nextcloud, updates NocoDB with URLs.
 * 
 * Status lifecycle: pending -> processing -> ready | error
 */

import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

const FAL_KEY = process.env.FAL_KEY
const FAL_API_URL = 'https://fal.run/fal-ai/nano-banana-pro/edit'
const NOCODB_BASE_URL = process.env.NOCODB_BASE_URL || 'https://nocodb.v1su4.com'
const NOCODB_API_TOKEN = process.env.NOCODB_API_TOKEN || ''
const NOCODB_TABLE_BEATS = process.env.NOCODB_TABLE_BEATS || 'may145m0gc24nmu'
const NOCODB_TABLE_KEYFRAMES = process.env.NOCODB_TABLE_KEYFRAMES || 'mc5xw2syf1fxek8'
const NEXTCLOUD_BASE_URL = process.env.NEXTCLOUD_BASE_URL || 'https://nextcloud.v1su4.com'
const NEXTCLOUD_USERNAME = process.env.NEXTCLOUD_USERNAME || 'admin'
const NEXTCLOUD_APP_PASSWORD = process.env.NEXTCLOUD_APP_PASSWORD || ''
const NEXTCLOUD_UPLOAD_PATH = process.env.NEXTCLOUD_UPLOAD_PATH || '/Storyception'

const WEBDAV_URL = `${NEXTCLOUD_BASE_URL}/remote.php/dav/files/${NEXTCLOUD_USERNAME}`
const SHARE_API_URL = `${NEXTCLOUD_BASE_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares`

// ============ NOCODB HELPERS ============

async function nocodbPatchByField(tableId: string, fieldName: string, fieldValue: string, updates: Record<string, unknown>) {
  // Find record by field value
  const findResp = await fetch(
    `${NOCODB_BASE_URL}/api/v2/tables/${tableId}/records?where=(${encodeURIComponent(fieldName)},eq,${encodeURIComponent(fieldValue)})`,
    { headers: { 'xc-token': NOCODB_API_TOKEN } }
  )
  if (!findResp.ok) return
  const data = await findResp.json()
  const record = data.list?.[0]
  if (!record) return

  // Find the internal Id
  const id = record.Id || record.id
  if (!id) return

  await fetch(`${NOCODB_BASE_URL}/api/v2/tables/${tableId}/records`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'xc-token': NOCODB_API_TOKEN },
    body: JSON.stringify([{ Id: id, ...updates }]),
  })
}

async function setKeyframeStatus(beatId: string, status: 'pending' | 'processing' | 'ready' | 'error') {
  // Update all keyframes for this beat
  const findResp = await fetch(
    `${NOCODB_BASE_URL}/api/v2/tables/${NOCODB_TABLE_KEYFRAMES}/records?where=(Beat ID,eq,${encodeURIComponent(beatId)})&limit=20`,
    { headers: { 'xc-token': NOCODB_API_TOKEN } }
  )
  if (!findResp.ok) return
  const data = await findResp.json()
  const records = data.list || []

  for (const record of records) {
    const id = record.Id || record.id
    if (!id) continue
    await fetch(`${NOCODB_BASE_URL}/api/v2/tables/${NOCODB_TABLE_KEYFRAMES}/records`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'xc-token': NOCODB_API_TOKEN },
      body: JSON.stringify([{ Id: id, Status: status }]),
    })
  }
}

// ============ NEXTCLOUD HELPERS ============

async function nextcloudCreateFolder(path: string) {
  const auth = Buffer.from(`${NEXTCLOUD_USERNAME}:${NEXTCLOUD_APP_PASSWORD}`).toString('base64')
  const parts = path.split('/').filter(Boolean)
  let currentPath = ''
  for (const part of parts) {
    currentPath += `/${part}`
    try {
      await fetch(`${WEBDAV_URL}${currentPath}/`, {
        method: 'MKCOL',
        headers: { Authorization: `Basic ${auth}` },
      })
    } catch { /* folder may exist */ }
  }
}

async function nextcloudUpload(buffer: Buffer, remotePath: string): Promise<boolean> {
  const auth = Buffer.from(`${NEXTCLOUD_USERNAME}:${NEXTCLOUD_APP_PASSWORD}`).toString('base64')
  const folderPath = remotePath.substring(0, remotePath.lastIndexOf('/'))
  await nextcloudCreateFolder(folderPath)
  const resp = await fetch(`${WEBDAV_URL}/${remotePath}`, {
    method: 'PUT',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'image/png' },
    body: buffer as unknown as BodyInit,
  })
  return resp.ok || resp.status === 201 || resp.status === 204
}

async function nextcloudShare(path: string): Promise<string | null> {
  const auth = Buffer.from(`${NEXTCLOUD_USERNAME}:${NEXTCLOUD_APP_PASSWORD}`).toString('base64')
  const resp = await fetch(SHARE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'OCS-APIRequest': 'true',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ path: `/${path}`, shareType: '3', permissions: '1' }),
  })
  if (resp.ok) {
    const text = await resp.text()
    const match = text.match(/<url>([^<]+)<\/url>/)
    if (match) return match[1].replace('http://', 'https://') + '/download'
  }
  return null
}

// ============ FAL.AI ============

function buildGridPrompt(beatLabel: string, description: string, duration?: string, percent?: number, branchContext?: string): string {
  // Describe the time span so fal.ai understands how much story to cover
  let timeContext = ''
  if (percent && percent >= 15) {
    timeContext = 'This is a major sequence — show significant story progression across multiple locations and moments.'
  } else if (percent && percent >= 8) {
    timeContext = 'This sequence covers several scenes — show the story moving forward through different moments.'
  } else if (percent && percent <= 3) {
    timeContext = 'This is a brief moment — the 9 frames are close together in time, same location.'
  }

  // If there's branch context, weave it into the scene description so images reflect the chosen path
  const sceneDescription = branchContext
    ? `${description} — Building on: ${branchContext}`
    : description

  return `Photoreal cinematic 3x3 contact sheet. 9 panels edge-to-edge, NO borders, NO gaps, 16:9.
Beat: ${beatLabel} — ${sceneDescription}${duration ? ` (${duration} of screen time)` : ''}
The reference person is the lead actor. Match their face exactly in every panel. Cinematic anamorphic film look. No text, no labels, no illustration.
Each panel is a different MOMENT in this story beat — time passes, locations can shift, actions progress. Not just camera angle changes. Tell the story visually across the 9 frames like scenes from a trailer. The character stays consistent but the story moves forward through each frame.${timeContext ? ' ' + timeContext : ''}`
}

async function generateGrid(imageUrls: string[], prompt: string): Promise<Buffer | null> {
  const resp = await fetch(FAL_API_URL, {
    method: 'POST',
    headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      image_urls: imageUrls,
      aspect_ratio: '16:9',
      resolution: '4K',
      num_images: 1,
      output_format: 'png',
      sync_mode: true,
    }),
  })

  if (!resp.ok) {
    console.error(`fal.ai error: ${resp.status} - ${await resp.text()}`)
    return null
  }

  const data = await resp.json()
  if (data.images?.[0]?.url) {
    const imgResp = await fetch(data.images[0].url)
    return Buffer.from(await imgResp.arrayBuffer())
  }
  return null
}

async function sliceGrid(gridBuffer: Buffer): Promise<Buffer[]> {
  const meta = await sharp(gridBuffer).metadata()
  const w = meta.width || 3840
  const h = meta.height || 2160
  const cw = Math.floor(w / 3)
  const ch = Math.floor(h / 3)
  const frames: Buffer[] = []

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      frames.push(
        await sharp(gridBuffer)
          .extract({ left: col * cw, top: row * ch, width: cw, height: ch })
          .png()
          .toBuffer()
      )
    }
  }
  return frames
}

// ============ MAIN HANDLER ============

export interface ImageGenRequest {
  sessionId: string
  beatId: string
  referenceImageUrl: string | string[]  // single URL or array of URLs
  beatLabel: string
  beatDescription: string
  beatDuration?: string     // e.g. "6s", "18s"
  beatPercent?: number      // percentage of total story (1-20)
  branchContext?: string    // Context from the player's branch choice leading into this beat
}

export async function POST(request: NextRequest) {
  try {
    const body: ImageGenRequest = await request.json()
    const { sessionId, beatId, referenceImageUrl, beatLabel, beatDescription, beatDuration, beatPercent, branchContext } = body

    if (!FAL_KEY) return NextResponse.json({ success: false, error: 'FAL_KEY not configured' }, { status: 500 })
    if (!referenceImageUrl) return NextResponse.json({ success: false, error: 'referenceImageUrl required' }, { status: 400 })
    if (!beatId) return NextResponse.json({ success: false, error: 'beatId required' }, { status: 400 })

    // Normalize to array of image URLs
    const imageUrls = Array.isArray(referenceImageUrl) ? referenceImageUrl : [referenceImageUrl]

    const root = (NEXTCLOUD_UPLOAD_PATH || '/Storyception').replace(/^\/+|\/+$/g, '') || 'Storyception'

    // 1. Set all keyframes to "processing"
    console.log(`🎬 [${beatId}] Starting image generation...`)
    await setKeyframeStatus(beatId, 'processing')
    await nocodbPatchByField(NOCODB_TABLE_BEATS, 'Beat ID', beatId, { Status: 'generating' })

    // 2. Generate grid with fal.ai (pass all reference images + branch context)
    if (branchContext) {
      console.log(`🎬 [${beatId}] Branch context: ${branchContext}`)
    }
    const prompt = buildGridPrompt(beatLabel, beatDescription, beatDuration, beatPercent, branchContext)
    const gridBuffer = await generateGrid(imageUrls, prompt)

    if (!gridBuffer) {
      await setKeyframeStatus(beatId, 'error')
      await nocodbPatchByField(NOCODB_TABLE_BEATS, 'Beat ID', beatId, { Status: 'pending' })
      return NextResponse.json({ success: false, error: 'fal.ai generation failed' }, { status: 500 })
    }

    // 3. Upload grid
    const gridPath = `${root}/${sessionId}/${beatId}/grid-4k.png`
    const gridUploaded = await nextcloudUpload(gridBuffer, gridPath)
    const gridShareUrl = gridUploaded ? await nextcloudShare(gridPath) : null

    // 4. Slice into 9 keyframes
    const keyframeBuffers = await sliceGrid(gridBuffer)
    const keyframeUrls: string[] = []
    const thumbnailUrls: string[] = []

    for (let i = 0; i < keyframeBuffers.length; i++) {
      // Upload full keyframe
      const kfPath = `${root}/${sessionId}/${beatId}/keyframe-${i + 1}.png`
      const uploaded = await nextcloudUpload(keyframeBuffers[i], kfPath)
      if (uploaded) {
        const url = await nextcloudShare(kfPath)
        if (url) keyframeUrls.push(url)
      }

      // Upload thumbnail (200px)
      const thumbBuffer = await sharp(keyframeBuffers[i]).resize(200, null, { fit: 'inside' }).png({ quality: 80 }).toBuffer()
      const thumbPath = `${root}/${sessionId}/${beatId}/thumb-${i + 1}.png`
      const thumbUp = await nextcloudUpload(thumbBuffer, thumbPath)
      if (thumbUp) {
        const thumbUrl = await nextcloudShare(thumbPath)
        if (thumbUrl) thumbnailUrls.push(thumbUrl)
      }
    }

    // 5. Update each keyframe record in NocoDB
    const findResp = await fetch(
      `${NOCODB_BASE_URL}/api/v2/tables/${NOCODB_TABLE_KEYFRAMES}/records?where=(Beat ID,eq,${encodeURIComponent(beatId)})&sort=Frame Index (1-9)&limit=20`,
      { headers: { 'xc-token': NOCODB_API_TOKEN } }
    )
    if (findResp.ok) {
      const findData = await findResp.json()
      const records = findData.list || []
      for (let i = 0; i < records.length && i < 9; i++) {
        const id = records[i].Id || records[i].id
        if (!id) continue
        const thumbAttach = thumbnailUrls[i] ? [{ url: thumbnailUrls[i], title: `thumb-${i + 1}.png`, mimetype: 'image/png' }] : null
        await fetch(`${NOCODB_BASE_URL}/api/v2/tables/${NOCODB_TABLE_KEYFRAMES}/records`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'xc-token': NOCODB_API_TOKEN },
          body: JSON.stringify([{
            Id: id,
            'Image URL': keyframeUrls[i] || null,
            Thumbnail: thumbAttach,
            Status: keyframeUrls[i] ? 'ready' : 'error',
          }]),
        })
      }
    }

    // 6. Update beat record
    await nocodbPatchByField(NOCODB_TABLE_BEATS, 'Beat ID', beatId, {
      'Keyframes (JSON)': JSON.stringify({ gridUrl: gridShareUrl, keyframes: keyframeUrls }),
      Status: 'ready',
    })

    console.log(`✅ [${beatId}] Images ready: ${keyframeUrls.length} keyframes`)

    return NextResponse.json({
      success: true,
      beatId,
      gridImageUrl: gridShareUrl,
      keyframeUrls,
      thumbnailUrls,
    })
  } catch (error) {
    console.error('Image generation error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Image generation failed' },
      { status: 500 }
    )
  }
}
