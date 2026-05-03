import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { 
  updateKeyframe, 
  updateBeat,
  nextcloudConfig
} from '@/lib/nocodb'
import { getGeminiApiKey } from '@/lib/gemini-api-key'

const MODEL = 'gemini-3-pro-image-preview'

async function nextcloudUpload(imageBuffer: Buffer, remotePath: string): Promise<string | null> {
  const auth = Buffer.from(`${nextcloudConfig.user}:${nextcloudConfig.appPassword}`).toString('base64')
  
  const uploadResponse = await fetch(`${nextcloudConfig.webdavUrl}/${remotePath}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'image/png',
    },
    body: imageBuffer as unknown as BodyInit,
  })

  if (!uploadResponse.ok) return null

  const shareResponse = await fetch(nextcloudConfig.shareApiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'OCS-APIRequest': 'true',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      path: `/${remotePath}`,
      shareType: '3',
      permissions: '1',
    }),
  })

  if (shareResponse.ok) {
    const text = await shareResponse.text()
    const urlMatch = text.match(/<url>([^<]+)<\/url>/)
    if (urlMatch) {
      return urlMatch[1].replace('http://', 'https://') + '/download'
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { beatId, sessionId, keyframePrompts, referenceImageBase64 } = body

    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No Gemini API key: set GOOGLE_GENERATIVE_AI_API_KEY, GOOGLE_GENAI_API_KEY, or GEMINI_API_KEY',
        },
        { status: 500 }
      )
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`

    // 1. Generate Storyboard with Native Nano Banana Pro (Gemini 3 Pro Image)
    const prompt = `Transform the provided reference image into a cinematic sequence of 9 keyframes arranged in a 3x3 grid. Keyframes: ${keyframePrompts.join(' | ')}`
    
    const payload = {
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: referenceImageBase64
            }
          },
          { text: prompt }
        ]
      }],
      generationConfig: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "2K"
        }
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Google Native API Error: ${response.status}`)
    }

    const data = await response.json()
    const generatedImageBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
    if (!generatedImageBase64) throw new Error('No image data in Google response')
    
    const gridBuffer = Buffer.from(generatedImageBase64, 'base64')

    // 2. Slice Grid into 9 Keyframes
    const metadata = await sharp(gridBuffer).metadata()
    const cellWidth = Math.floor((metadata.width || 2048) / 3)
    const cellHeight = Math.floor((metadata.height || 1152) / 3)

    const keyframeUrls = []
    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / 3)
      const col = i % 3
      const cellBuffer = await sharp(gridBuffer)
        .extract({ 
          left: col * cellWidth, 
          top: row * cellHeight, 
          width: cellWidth, 
          height: cellHeight 
        })
        .png()
        .toBuffer()

      const remotePath = `Storyception/${sessionId}/${beatId}/kf-${i + 1}.png`
      const publicUrl = await nextcloudUpload(cellBuffer, remotePath)
      
      if (publicUrl) {
        keyframeUrls.push(publicUrl)
        const keyframeId = `${beatId}-kf-${i + 1}`
        await updateKeyframe(keyframeId, {
          imageUrl: publicUrl,
          status: 'ready'
        })
      }
    }

    await updateBeat(beatId, {
      status: 'ready',
      keyframesJson: JSON.stringify({ keyframes: keyframeUrls })
    })

    return NextResponse.json({
      success: true,
      keyframes: keyframeUrls
    })

  } catch (error) {
    console.error('Native Image Generation Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to generate images' }, { status: 500 })
  }
}
