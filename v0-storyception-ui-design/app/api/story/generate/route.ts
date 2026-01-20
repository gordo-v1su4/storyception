/**
 * Story Generation API Route
 * 
 * Triggers the N8N workflow that:
 * 1. Takes archetype + outcome + reference images
 * 2. Sends to Gemini for story beat generation
 * 3. Returns structured story data
 */

import { NextRequest, NextResponse } from 'next/server'

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://n8n.v1su4.com'
const N8N_WEBHOOK_STORY = process.env.N8N_WEBHOOK_STORY_GENERATE || '/webhook/story-generate'

export interface StoryGenerationRequest {
  archetypeIndex: number
  archetypeName: string
  outcomeIndex: number
  outcomeName: string
  referenceImages?: string[]  // Base64 encoded images
  totalDuration?: number      // Target duration in seconds (default 90)
}

export interface GeneratedBeat {
  id: string
  label: string
  description: string
  duration: number
  percentage: number
  sceneIdea: string
  imagePrompts: string[]  // 9 prompts for the keyframe grid
}

export interface StoryGenerationResponse {
  success: boolean
  storyId: string
  beats: GeneratedBeat[]
  metadata: {
    archetype: string
    outcome: string
    totalDuration: number
    generatedAt: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: StoryGenerationRequest = await request.json()
    
    // Validate required fields
    if (body.archetypeIndex === undefined || body.outcomeIndex === undefined) {
      return NextResponse.json(
        { error: 'archetypeIndex and outcomeIndex are required' },
        { status: 400 }
      )
    }
    
    // Prepare payload for N8N workflow
    const payload = {
      archetype: {
        index: body.archetypeIndex,
        name: body.archetypeName,
      },
      outcome: {
        index: body.outcomeIndex,
        name: body.outcomeName,
      },
      referenceImages: body.referenceImages || [],
      config: {
        totalDuration: body.totalDuration || 90,
        generateImagePrompts: true,
        keyframesPerBeat: 9,
      },
      timestamp: new Date().toISOString(),
    }
    
    // Trigger N8N webhook
    const response = await fetch(`${N8N_BASE_URL}${N8N_WEBHOOK_STORY}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('N8N Story Generation Error:', errorText)
      
      // Return mock data for development if N8N is not configured
      if (response.status === 404) {
        return NextResponse.json({
          success: true,
          message: 'Development mode - N8N webhook not configured',
          storyId: `dev-${Date.now()}`,
          beats: [],
          metadata: {
            archetype: body.archetypeName,
            outcome: body.outcomeName,
            totalDuration: body.totalDuration || 90,
            generatedAt: new Date().toISOString(),
          }
        })
      }
      
      throw new Error(`N8N Error: ${response.status} - ${errorText}`)
    }
    
    const result = await response.json()
    
    return NextResponse.json({
      success: true,
      ...result,
    })
    
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

// GET - Check story generation status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const storyId = searchParams.get('storyId')
  
  if (!storyId) {
    return NextResponse.json({
      message: 'Story Generation API',
      usage: 'POST with archetypeIndex, outcomeIndex, and optional referenceImages',
      endpoint: N8N_WEBHOOK_STORY,
    })
  }
  
  // TODO: Implement story status check via NocoDB or N8N execution status
  return NextResponse.json({
    storyId,
    status: 'pending',
    message: 'Story status check not yet implemented',
  })
}
