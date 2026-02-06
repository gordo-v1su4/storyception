/**
 * Test API Route: Grid Pipeline (fal.ai Nano Banana Pro)
 * 
 * Workflow:
 * 1. Take reference image (headshot)
 * 2. Call fal.ai ONCE → generate ONE 4K 3x3 grid image
 * 3. Split/slice grid into 9 individual keyframes using sharp
 * 4. Upload grid + 9 keyframes to Nextcloud
 * 5. Save records to NocoDB
 * 
 * ONE image generated, then split. No text on output.
 */

import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

// Environment variables
const FAL_KEY = process.env.FAL_KEY
const NOCODB_BASE_URL = process.env.NOCODB_BASE_URL || 'https://nocodb.v1su4.com'
const NOCODB_API_TOKEN = process.env.NOCODB_API_TOKEN || ''
const NEXTCLOUD_BASE_URL = process.env.NEXTCLOUD_BASE_URL || 'https://nextcloud.v1su4.com'
const NEXTCLOUD_USERNAME = process.env.NEXTCLOUD_USERNAME || 'admin'
const NEXTCLOUD_APP_PASSWORD = process.env.NEXTCLOUD_APP_PASSWORD || ''

// Table IDs
const TABLE_SESSIONS = process.env.NOCODB_TABLE_SESSIONS || 'm1icipflxgrce6y'
const TABLE_BEATS = process.env.NOCODB_TABLE_BEATS || 'ms4mo8ekjtrqz48'
const TABLE_KEYFRAMES = process.env.NOCODB_TABLE_KEYFRAMES || 'm301ac822mwqpy0'

// Nextcloud URLs
const WEBDAV_URL = `${NEXTCLOUD_BASE_URL}/remote.php/dav/files/${NEXTCLOUD_USERNAME}`
const OCS_SHARE_URL = `${NEXTCLOUD_BASE_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares`

// fal.ai Nano Banana Pro API
const FAL_API_URL = 'https://fal.run/fal-ai/nano-banana-pro/edit'

interface TestRequest {
  referenceImageUrl?: string
  beatLabel?: string
  beatDescription?: string
  style?: string
}

// The master prompt for generating a 3x3 grid (based on original_cinematic_grid.md)
function buildGridPrompt(beatLabel: string, beatDescription: string, style: string): string {
  return `You are an award-winning trailer director and storyboard artist.

TASK: Transform the reference image into a cinematic 3x3 grid storyboard.

SCENE: ${beatLabel}
DESCRIPTION: ${beatDescription}
STYLE: ${style}

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

// ============ HELPER FUNCTIONS ============

async function nocodbCreate(tableId: string, data: Record<string, unknown>) {
  const response = await fetch(`${NOCODB_BASE_URL}/api/v2/tables/${tableId}/records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xc-token': NOCODB_API_TOKEN,
    },
    body: JSON.stringify(data),
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`NocoDB Error: ${response.status} - ${error}`)
  }
  
  return response.json()
}

async function nextcloudCreateFolder(path: string) {
  const auth = Buffer.from(`${NEXTCLOUD_USERNAME}:${NEXTCLOUD_APP_PASSWORD}`).toString('base64')
  
  const parts = path.split('/').filter(Boolean)
  let currentPath = ''
  
  for (const part of parts) {
    currentPath += `/${part}`
    try {
      await fetch(`${WEBDAV_URL}${currentPath}/`, {
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
  
  const response = await fetch(`${WEBDAV_URL}/${remotePath}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'image/png',
    },
    body: new Uint8Array(imageBuffer),
  })
  
  return response.ok || response.status === 201 || response.status === 204
}

async function nextcloudCreateShare(path: string): Promise<string | null> {
  const auth = Buffer.from(`${NEXTCLOUD_USERNAME}:${NEXTCLOUD_APP_PASSWORD}`).toString('base64')
  
  const response = await fetch(OCS_SHARE_URL, {
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

async function generateGridWithFal(
  referenceImageUrl: string,
  prompt: string
): Promise<Buffer | null> {
  console.log('🎬 Calling fal.ai Nano Banana Pro...')
  console.log(`   Reference: ${referenceImageUrl}`)
  console.log(`   Prompt length: ${prompt.length} chars`)
  
  const response = await fetch(FAL_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: prompt,
      image_urls: [referenceImageUrl],
      aspect_ratio: '16:9',
      resolution: '4K',  // 4K for best quality grid
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
  console.log('📸 fal.ai response received')
  
  if (data.images && data.images.length > 0) {
    const imageUrl = data.images[0].url
    console.log(`   Image URL: ${imageUrl}`)
    
    // Download the generated grid image
    const imgResponse = await fetch(imageUrl)
    const arrayBuffer = await imgResponse.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    console.log(`   Downloaded: ${buffer.length} bytes`)
    return buffer
  }

  console.error('No images in fal.ai response')
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
  
  // Get image dimensions
  const metadata = await sharp(gridBuffer).metadata()
  const width = metadata.width || 3840
  const height = metadata.height || 2160
  
  // Calculate cell dimensions (3x3 grid)
  const cellWidth = Math.floor(width / 3)
  const cellHeight = Math.floor(height / 3)
  
  console.log(`📐 Grid: ${width}x${height} → Cells: ${cellWidth}x${cellHeight}`)
  
  // Extract each cell (row by row, left to right)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const left = col * cellWidth
      const top = row * cellHeight
      const frameNum = row * 3 + col + 1
      
      const cellBuffer = await sharp(gridBuffer)
        .extract({
          left,
          top,
          width: cellWidth,
          height: cellHeight,
        })
        .png()
        .toBuffer()
      
      keyframes.push(cellBuffer)
      console.log(`   ✂️ KF${frameNum}: extracted from (${left}, ${top})`)
    }
  }
  
  return keyframes
}

// ============ MAIN API HANDLER ============

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const logs: string[] = []
  
  const log = (msg: string) => {
    console.log(msg)
    logs.push(`${Date.now() - startTime}ms: ${msg}`)
  }

  try {
    log('🚀 Starting grid pipeline (1 image → split into 9)...')
    
    // Validate environment
    if (!FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
    }
    if (!NOCODB_API_TOKEN) {
      return NextResponse.json({ error: 'NOCODB_API_TOKEN not configured' }, { status: 500 })
    }
    if (!NEXTCLOUD_APP_PASSWORD) {
      return NextResponse.json({ error: 'NEXTCLOUD_APP_PASSWORD not configured' }, { status: 500 })
    }

    // Parse request
    const body: TestRequest = await request.json()
    
    const referenceImageUrl = body.referenceImageUrl
    
    if (!referenceImageUrl) {
      return NextResponse.json({ 
        error: 'referenceImageUrl required (must be a publicly accessible URL)' 
      }, { status: 400 })
    }

    const beatLabel = body.beatLabel || 'Cinematic Scene'
    const beatDescription = body.beatDescription || 'dramatic cinematic moment'
    const style = body.style || 'cinematic, photoreal, film quality, dramatic lighting'
    
    // Generate unique IDs
    const timestamp = Date.now()
    const sessionId = `test-${timestamp}`
    const beatId = `${sessionId}-beat-1`
    
    log(`📝 Session: ${sessionId}`)
    log(`🖼️ Reference: ${referenceImageUrl}`)

    // ============ STEP 1: Create Session in NocoDB ============
    log('📊 Creating session in NocoDB...')
    
    await nocodbCreate(TABLE_SESSIONS, {
      'Session ID': sessionId,
      'User ID': 'test-user',
      'Archetype': 'Test',
      'Outcome': 'Grid Pipeline Test',
      'Reference Image URL': referenceImageUrl,  // Store the reference!
      'Status': 'active',
      'Current Beat': 1,
      'Total Beats': 1,
      'Created At': new Date().toISOString(),
      'Updated At': new Date().toISOString(),
    })
    
    log('✅ Session created')

    // ============ STEP 2: Create Beat in NocoDB ============
    log('📊 Creating beat in NocoDB...')
    
    await nocodbCreate(TABLE_BEATS, {
      'Beat ID': beatId,
      'Session ID': sessionId,
      'Beat Index': 1,
      'Beat Label': beatLabel,
      'Description': beatDescription,
      'Duration': '6s',
      'Percent of Total': 100,
      'Status': 'generating',
      'Created At': new Date().toISOString(),
    })
    
    log('✅ Beat created')

    // ============ STEP 3: Generate ONE 4K Grid with fal.ai ============
    log('🎨 Generating ONE 4K 3x3 grid with fal.ai...')
    log('   (This may take 30-60 seconds)')
    
    const gridPrompt = buildGridPrompt(beatLabel, beatDescription, style)
    const gridBuffer = await generateGridWithFal(referenceImageUrl, gridPrompt)
    
    if (!gridBuffer) {
      return NextResponse.json({
        error: 'Failed to generate grid image from fal.ai',
        logs,
      }, { status: 500 })
    }
    
    log(`✅ Grid generated: ${gridBuffer.length} bytes`)

    // ============ STEP 4: Upload Grid to Nextcloud ============
    log('☁️ Uploading grid to Nextcloud...')
    
    const gridPath = `Storyception/${sessionId}/${beatId}/grid-4k.png`
    const gridUploaded = await nextcloudUpload(gridBuffer, gridPath)
    
    let gridShareUrl: string | null = null
    if (gridUploaded) {
      gridShareUrl = await nextcloudCreateShare(gridPath)
      log(`✅ Grid uploaded: ${gridShareUrl}`)
    } else {
      log('⚠️ Grid upload failed')
    }

    // ============ STEP 5: Split Grid into 9 Keyframes ============
    log('✂️ Slicing grid into 9 keyframes...')
    
    const keyframeBuffers = await sliceGridIntoKeyframes(gridBuffer)
    
    log(`✅ Sliced into ${keyframeBuffers.length} keyframes`)

    // ============ STEP 6: Upload Individual Keyframes + Thumbnails ============
    log('☁️ Uploading 9 keyframes + thumbnails to Nextcloud...')
    
    const keyframeUrls: string[] = []
    const thumbnailUrls: string[] = []
    
    for (let i = 0; i < keyframeBuffers.length; i++) {
      // Upload full keyframe
      const keyframePath = `Storyception/${sessionId}/${beatId}/keyframe-${i + 1}.png`
      const uploaded = await nextcloudUpload(keyframeBuffers[i], keyframePath)
      
      if (uploaded) {
        const shareUrl = await nextcloudCreateShare(keyframePath)
        if (shareUrl) {
          keyframeUrls.push(shareUrl)
        }
      }
      
      // Generate and upload thumbnail (200px width)
      const thumbnailBuffer = await generateThumbnail(keyframeBuffers[i], 200)
      const thumbnailPath = `Storyception/${sessionId}/${beatId}/thumb-${i + 1}.png`
      const thumbUploaded = await nextcloudUpload(thumbnailBuffer, thumbnailPath)
      
      if (thumbUploaded) {
        const thumbShareUrl = await nextcloudCreateShare(thumbnailPath)
        if (thumbShareUrl) {
          thumbnailUrls.push(thumbShareUrl)
        }
      }
    }
    
    log(`✅ ${keyframeUrls.length} keyframes + ${thumbnailUrls.length} thumbnails uploaded`)

    // ============ STEP 7: Save Keyframes to NocoDB ============
    log('📊 Saving keyframes to NocoDB...')
    
    for (let i = 0; i < 9; i++) {
      const keyframeUrl = keyframeUrls[i] || null
      const thumbnailUrl = thumbnailUrls[i] || null
      
      // NocoDB Attachment format: array of objects with url, title, mimetype
      const thumbnailAttachment = thumbnailUrl ? [
        {
          url: thumbnailUrl,
          title: `thumb-${i + 1}.png`,
          mimetype: 'image/png',
        }
      ] : null
      
      await nocodbCreate(TABLE_KEYFRAMES, {
        'Keyframe ID': `${beatId}-kf-${i + 1}`,
        'Session ID': sessionId,
        'Beat ID': beatId,
        'Frame Index (1-9)': i + 1,
        'Grid Row': Math.floor(i / 3) + 1,
        'Grid Col': (i % 3) + 1,
        'Prompt': `KF${i + 1}`,
        'Image URL': keyframeUrl,
        'Thumbnail': thumbnailAttachment,
        'Status': keyframeUrl ? 'ready' : 'pending',
        'Created At': new Date().toISOString(),
      })
    }
    
    log(`✅ 9 keyframes saved to NocoDB`)

    // ============ STEP 8: Update Beat with Keyframes JSON ============
    log('📊 Updating beat with keyframes JSON...')
    
    // First, find the beat record to get its internal NocoDB ID
    const findBeatResponse = await fetch(
      `${NOCODB_BASE_URL}/api/v2/tables/${TABLE_BEATS}/records?where=(Beat ID,eq,${encodeURIComponent(beatId)})`,
      {
        headers: {
          'xc-token': NOCODB_API_TOKEN,
        },
      }
    )
    
    if (findBeatResponse.ok) {
      const findBeatData = await findBeatResponse.json()
      if (findBeatData.list && findBeatData.list.length > 0) {
        const beatRecord = findBeatData.list[0]
        const beatRowId = beatRecord.Id
        
        // Now update with the internal ID
        await fetch(`${NOCODB_BASE_URL}/api/v2/tables/${TABLE_BEATS}/records`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'xc-token': NOCODB_API_TOKEN,
          },
          body: JSON.stringify([{
            'Id': beatRowId,
            'Keyframes (JSON)': JSON.stringify({
              gridUrl: gridShareUrl,
              keyframes: keyframeUrls,
            }),
            'Status': 'ready',
          }]),
        })
        
        log('✅ Beat updated with keyframes')
      } else {
        log('⚠️ Could not find beat record to update')
      }
    } else {
      log('⚠️ Failed to query beat record')
    }

    // ============ DONE ============
    const totalTime = Date.now() - startTime
    log(`🎉 Pipeline complete in ${Math.round(totalTime / 1000)}s`)

    return NextResponse.json({
      success: true,
      sessionId,
      beatId,
      imagesGenerated: 1,  // Only ONE image was generated
      grid: {
        url: gridShareUrl,
        format: '4K 16:9 3x3 grid',
      },
      keyframes: {
        count: keyframeUrls.length,
        urls: keyframeUrls,
        thumbnails: thumbnailUrls,
      },
      totalTimeMs: totalTime,
      totalTimeSeconds: Math.round(totalTime / 1000),
      logs,
      links: {
        nocodb: NOCODB_BASE_URL,
        nextcloud: `${NEXTCLOUD_BASE_URL}/apps/files/?dir=/Storyception/${sessionId}`,
      },
    })

  } catch (error) {
    console.error('Pipeline Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Pipeline failed',
      logs,
    }, { status: 500 })
  }
}

// GET - API info
export async function GET() {
  return NextResponse.json({
    name: 'Grid Pipeline (fal.ai Nano Banana Pro)',
    workflow: [
      '1. Reference image (headshot) provided',
      '2. fal.ai generates ONE 4K 3x3 grid image',
      '3. Grid is sliced into 9 individual keyframes',
      '4. All images uploaded to Nextcloud',
      '5. Records saved to NocoDB',
    ],
    imagesGenerated: '1 (then split into 9)',
    usage: {
      method: 'POST',
      body: {
        referenceImageUrl: 'REQUIRED - Public URL to reference headshot',
        beatLabel: 'Scene title (optional)',
        beatDescription: 'Scene description (optional)',
        style: 'Visual style (optional)',
      },
    },
  })
}
