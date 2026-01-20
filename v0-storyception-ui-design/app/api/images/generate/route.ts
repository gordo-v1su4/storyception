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
    
    // Validate
    if (!body.storyId || !body.beatId) {
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
    
    return NextResponse.json(
      { error: 'Either referenceImageUrl/referenceImageBase64 OR basePrompt is required' },
      { status: 400 }
    )
    
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

// Development fallback with placeholder data
function devFallbackResponse(body: ImageGenerationRequest, method: 'nanobanana' | 'flux+nanobanana') {
  const placeholderKeyframes: KeyframeImage[] = body.prompts.slice(0, 9).map((prompt, idx) => ({
    id: idx + 1,
    url: `/placeholder.jpg`,
    prompt,
    position: {
      row: Math.floor(idx / 3),
      col: idx % 3,
    }
  }))
  
  return NextResponse.json({
    success: true,
    message: `Development mode - ${method} webhook not configured`,
    requestId: `dev-${Date.now()}`,
    method,
    status: 'completed',
    keyframes: placeholderKeyframes,
    metadata: {
      beatId: body.beatId,
      branchId: body.branchId,
      referenceUsed: !!(body.referenceImageUrl || body.referenceImageBase64),
      generatedAt: new Date().toISOString(),
    }
  } as ImageGenerationResponse)
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
