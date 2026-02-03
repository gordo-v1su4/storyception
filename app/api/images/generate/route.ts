/**
 * Image Generation API Route
 * 
 * PRIMARY: Gemini (gemini-3-pro-image-preview) - "Nano Banana Pro"
 * - Takes user's reference image + beat context
 * - Creates ENTIRE 3x3 grid (9 keyframes) in ONE API call
 * - Best quality, maintains character consistency
 * 
 * FALLBACK 1: fal.ai Nano Banana
 * - 9 separate calls for each keyframe
 * - Faster per-image but less consistent
 * 
 * FALLBACK 2: fal.ai Flux Pro 2
 * - Only used if NO user reference image
 * - Creates a base image from text prompt
 * 
 * NO ComfyUI - everything via Gemini or fal.ai APIs
 */

import { NextRequest, NextResponse } from 'next/server'

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://n8n.v1su4.com'

// Webhook paths - created in N8N
const N8N_WEBHOOK_GEMINI = '/webhook/storyception-gemini-grid'    // Workflow: xKOUwmCFXItiWWHc (PREFERRED)
const N8N_WEBHOOK_NANOBANANA = '/webhook/storyception-keyframes'  // Workflow: ttJRXPHV6olcrDwV
const N8N_WEBHOOK_FLUX = '/webhook/storyception-base-image'       // Workflow: kNBsr98q1k0OQ4Hy

export interface ImageGenerationRequest {
  storyId: string
  beatId: string
  branchId?: string
  
  // Reference image from user (required for Gemini/Nano Banana)
  referenceImageUrl?: string
  referenceImageBase64?: string
  
  // Beat context for Gemini grid generation
  beatLabel?: string
  beatDescription?: string
  
  // 9 prompts for keyframe variations (only for fal.ai fallback)
  prompts?: string[]
  
  // Style/mood
  style?: string  // cinematic, anime, realistic, etc.
  
  // Generation method preference
  method?: 'gemini' | 'fal-nanobanana' | 'auto'  // default: auto (tries gemini first)
  
  // Only used if no reference image - for Flux Pro 2
  basePrompt?: string
}

export interface KeyframeImage {
  id: number
  url: string
  prompt: string
  position: { row: number; col: number }
}

export interface ImageGenerationResponse {
  success: boolean
  requestId: string
  method: 'nanobanana' | 'flux+nanobanana'
  status: 'queued' | 'processing' | 'completed' | 'failed'
  
  // The 3x3 grid from Nano Banana
  gridImageUrl?: string
  
  // Split into 9 individual keyframes
  keyframes?: KeyframeImage[]
  
  metadata: {
    beatId: string
    branchId?: string
    referenceUsed: boolean
    generatedAt?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ImageGenerationRequest = await request.json()
    
    console.log('📸 Image generation request:', {
      storyId: body.storyId,
      beatId: body.beatId,
      hasReferenceImage: !!(body.referenceImageUrl || body.referenceImageBase64),
      method: body.method,
      beatLabel: body.beatLabel,
    })
    
    // Validate
    if (!body.storyId || !body.beatId) {
      console.log('❌ Missing storyId or beatId')
      return NextResponse.json(
        { error: 'storyId and beatId are required' },
        { status: 400 }
      )
    }
    
    const hasReferenceImage = body.referenceImageUrl || body.referenceImageBase64
    const method = body.method || 'auto'
    
    // CASE 1: Gemini Grid Generation (PREFERRED)
    // Single API call creates entire 3x3 grid with character consistency
    if (hasReferenceImage && (method === 'gemini' || method === 'auto')) {
      const payload = {
        storyId: body.storyId,
        beatId: body.beatId,
        branchId: body.branchId,
        referenceImageUrl: body.referenceImageUrl,
        referenceImageBase64: body.referenceImageBase64,
        beatLabel: body.beatLabel || 'Story Beat',
        beatDescription: body.beatDescription || '',
        style: body.style || 'cinematic',
        timestamp: new Date().toISOString(),
      }
      
      const response = await fetch(`${N8N_BASE_URL}${N8N_WEBHOOK_GEMINI}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      
      if (response.ok) {
        const result = await response.json()
        return NextResponse.json({
          success: true,
          method: 'gemini',
          ...result,
        })
      }
      
      // If Gemini fails and method is 'auto', fall through to fal.ai
      if (method === 'gemini') {
        if (response.status === 404) {
          return devFallbackResponse(body, 'gemini')
        }
        throw new Error(`Gemini webhook error: ${response.status}`)
      }
      
      console.log('Gemini failed, falling back to fal.ai Nano Banana')
    }
    
    // CASE 2: fal.ai Nano Banana (fallback or explicit)
    // 9 separate API calls, one per keyframe
    if (hasReferenceImage && body.prompts && body.prompts.length >= 9) {
      const payload = {
        storyId: body.storyId,
        beatId: body.beatId,
        branchId: body.branchId,
        referenceImage: body.referenceImageUrl || body.referenceImageBase64,
        prompts: body.prompts,
        style: body.style || 'cinematic',
        gridSize: '3x3',
        timestamp: new Date().toISOString(),
      }
      
      const response = await fetch(`${N8N_BASE_URL}${N8N_WEBHOOK_NANOBANANA}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      
      if (!response.ok) {
        if (response.status === 404) {
          return devFallbackResponse(body, 'fal-nanobanana')
        }
        throw new Error(`Nano Banana webhook error: ${response.status}`)
      }
      
      const result = await response.json()
      return NextResponse.json({
        success: true,
        method: 'fal-nanobanana',
        ...result,
      })
    }
    
    // CASE 3: No reference image → Flux Pro 2 creates base image
    if (!hasReferenceImage && body.basePrompt) {
      const payload = {
        storyId: body.storyId,
        beatId: body.beatId,
        branchId: body.branchId,
        basePrompt: body.basePrompt,
        prompts: body.prompts || [],
        style: body.style || 'cinematic',
        model: 'flux-pro-v1.1',
        timestamp: new Date().toISOString(),
      }
      
      const response = await fetch(`${N8N_BASE_URL}${N8N_WEBHOOK_FLUX}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      
      if (!response.ok) {
        if (response.status === 404) {
          return devFallbackResponse(body, 'flux')
        }
        throw new Error(`Flux webhook error: ${response.status}`)
      }
      
      const result = await response.json()
      return NextResponse.json({
        success: true,
        method: 'flux',
        ...result,
      })
    }
    
    // CASE 4: No reference image and no base prompt - return dev fallback
    // This allows the UI to work in development without image generation
    console.log('⚠️ No reference image or base prompt - returning dev fallback')
    return devFallbackResponse(body, 'gemini')
    
  } catch (error) {
    console.error('Image Generation Error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Image generation failed',
      },
      { status: 500 }
    )
  }
}

// Cinematic shot types for 3x3 grid keyframe progression
const SHOT_PROGRESSION = [
  { type: 'ELS', desc: 'Extreme wide establishing shot', duration: '3s' },
  { type: 'LS', desc: 'Long shot introducing scene', duration: '3s' },
  { type: 'MLS', desc: 'Medium long shot showing characters', duration: '3s' },
  { type: 'MS', desc: 'Medium shot character interaction', duration: '3s' },
  { type: 'MCU', desc: 'Medium close-up emotional moment', duration: '3s' },
  { type: 'CU', desc: 'Close-up on key action', duration: '3s' },
  { type: 'ECU', desc: 'Extreme close-up detail', duration: '3s' },
  { type: 'Low', desc: 'Low angle power shot', duration: '3s' },
  { type: 'High', desc: 'High angle overview', duration: '3s' },
]

/**
 * Build the master prompt for generating ONE 3x3 grid image
 * This follows the structure from original_cinematic_grid.md
 */
function buildGridPrompt(beatLabel: string, beatDescription: string, style: string = 'cinematic') {
  const keyframeDescriptions = SHOT_PROGRESSION.map((shot, i) => 
    `KF${i + 1} [${shot.type} | ${shot.duration}]: ${shot.desc}`
  ).join('\n')

  return {
    masterPrompt: `Generate a single 3x3 cinematic contact sheet / storyboard grid for:
BEAT: ${beatLabel}
SCENE: ${beatDescription}
STYLE: ${style}, photoreal, consistent lighting and color grade

The grid must contain 9 panels arranged 3x3, each showing a different shot of the SAME scene with the SAME characters maintaining strict visual continuity.

Shot progression (left-to-right, top-to-bottom):
${keyframeDescriptions}

REQUIREMENTS:
- ONE single image containing all 9 keyframes in a 3x3 grid
- Each panel labeled with KF number and shot type
- Strict continuity: same subjects, wardrobe, environment, lighting across ALL panels
- Only action, expression, and camera angle changes between shots
- Cinematic color grade consistent across entire grid`,
    
    keyframeSpecs: SHOT_PROGRESSION.map((shot, i) => ({
      id: i + 1,
      shot: shot.type,
      duration: shot.duration,
      description: `${shot.desc} - ${beatDescription}`,
      position: { row: Math.floor(i / 3), col: i % 3 }
    }))
  }
}

// Development fallback - simulates the grid generation flow
function devFallbackResponse(body: ImageGenerationRequest, method: string) {
  console.log('🎬 Dev fallback - Building grid prompt for:', body.beatLabel)
  
  const beatLabel = body.beatLabel || 'Scene'
  const beatDesc = body.beatDescription || 'Cinematic moment'
  const style = body.style || 'cinematic'
  
  const { masterPrompt, keyframeSpecs } = buildGridPrompt(beatLabel, beatDesc, style)
  
  // In dev mode, use placeholder - in production, this would be the actual grid image URL
  const gridImageUrl = '/placeholder.jpg'
  
  // Simulate the split keyframes (in production, these would be actual cropped URLs from the grid)
  const keyframes: KeyframeImage[] = keyframeSpecs.map(spec => ({
    id: spec.id,
    url: `/placeholder.jpg`, // In production: URLs to individual cropped keyframes
    prompt: `[KF${spec.id} | ${spec.shot}] ${spec.description}`,
    position: spec.position,
  }))
  
  console.log(`✅ Dev fallback: Grid prompt built with ${keyframes.length} keyframe specs`)
  
  return NextResponse.json({
    success: true,
    message: `Development mode - ${method} webhook not configured. In production, ONE 3x3 grid image will be generated and split into 9 keyframes.`,
    requestId: `dev-${Date.now()}`,
    method,
    status: 'completed',
    
    // The main output - ONE grid image that contains all 9 keyframes
    gridImageUrl,
    
    // The split keyframes (cropped from the grid)
    keyframes,
    keyframeUrls: keyframes.map(kf => kf.url),
    
    // The prompt used to generate the grid
    gridPrompt: masterPrompt,
    keyframeSpecs,
    
    metadata: {
      beatId: body.beatId,
      branchId: body.branchId,
      referenceUsed: !!(body.referenceImageUrl || body.referenceImageBase64),
      generatedAt: new Date().toISOString(),
    }
  })
}

// GET - API info
export async function GET() {
  return NextResponse.json({
    message: 'Image Generation API',
    pipeline: {
      primary: 'Nano Banana Pro - reference image → 9 keyframes',
      fallback: 'fal.ai Flux Pro 2 → base image → Nano Banana → 9 keyframes',
    },
    usage: {
      withReference: 'POST with referenceImageUrl + 9 prompts',
      withoutReference: 'POST with basePrompt + 9 prompts',
    },
    noComfyUI: true,
  })
}
