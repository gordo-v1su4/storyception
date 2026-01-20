/**
 * Branch Generation API Route
 * 
 * Generates branch options (A, B, C) for a story beat:
 * 1. Takes current story context + beat info
 * 2. Generates 3 alternative paths via Gemini
 * 3. Triggers parallel image generation for each branch
 * 4. Returns branches with pre-cached 9-frame grids
 * 
 * This is the core of "Storyception" - multi-level branching
 */

import { NextRequest, NextResponse } from 'next/server'

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://n8n.v1su4.com'
const N8N_WEBHOOK_BRANCH = process.env.N8N_WEBHOOK_BRANCH_GENERATE || '/webhook/branch-generate'

export interface BranchGenerationRequest {
  storyId: string
  beatId: string
  beatLabel: string
  currentContext: string       // Story so far
  archetype: string
  outcome: string
  depth?: number               // Inception depth (0 = main story, 1+ = nested branch)
  parentBranchId?: string      // If this is a nested branch
}

export interface GeneratedBranch {
  id: string
  label: string                // e.g., "Path A: The Confrontation"
  title: string
  description: string
  type: string                 // confrontation, discovery, escape, etc.
  duration: string
  sceneIdea: string
  imagePrompts: string[]       // 9 prompts for keyframe grid
  keyframes?: {
    id: number
    url: string
    prompt: string
  }[]
  consequences: string         // How this affects future beats
}

export interface BranchGenerationResponse {
  success: boolean
  requestId: string
  status: 'generating' | 'ready' | 'failed'
  branches: GeneratedBranch[]
  metadata: {
    beatId: string
    depth: number
    parentBranchId?: string
    generatedAt: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: BranchGenerationRequest = await request.json()
    
    // Validate required fields
    if (!body.storyId || !body.beatId) {
      return NextResponse.json(
        { error: 'storyId and beatId are required' },
        { status: 400 }
      )
    }
    
    const payload = {
      storyId: body.storyId,
      beat: {
        id: body.beatId,
        label: body.beatLabel,
      },
      context: body.currentContext || '',
      archetype: body.archetype,
      outcome: body.outcome,
      branchConfig: {
        count: 3,                           // Always A, B, C
        depth: body.depth || 0,
        parentBranchId: body.parentBranchId,
        generateImages: true,               // Pre-generate all 3 sets
        parallelImageGeneration: true,      // Generate all in parallel
      },
      timestamp: new Date().toISOString(),
    }
    
    // Trigger N8N webhook for branch generation
    const response = await fetch(`${N8N_BASE_URL}${N8N_WEBHOOK_BRANCH}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('N8N Branch Generation Error:', errorText)
      
      // Return mock branches for development
      if (response.status === 404) {
        const mockBranches: GeneratedBranch[] = [
          {
            id: `${body.beatId}-a`,
            label: 'Path A',
            title: 'The Confrontation',
            description: 'Face the challenge head-on with courage and determination.',
            type: 'confrontation',
            duration: '8.0s',
            sceneIdea: 'The hero steps forward, ready to face whatever comes.',
            imagePrompts: Array(9).fill('Placeholder prompt'),
            consequences: 'Higher risk, potentially higher reward.',
          },
          {
            id: `${body.beatId}-b`,
            label: 'Path B',
            title: 'The Discovery',
            description: 'Uncover a hidden truth that changes everything.',
            type: 'discovery',
            duration: '6.5s',
            sceneIdea: 'A revelation emerges from the shadows.',
            imagePrompts: Array(9).fill('Placeholder prompt'),
            consequences: 'New information unlocks alternative paths.',
          },
          {
            id: `${body.beatId}-c`,
            label: 'Path C',
            title: 'The Escape',
            description: 'Retreat to fight another day, preserving what matters.',
            type: 'escape',
            duration: '5.0s',
            sceneIdea: 'Quick thinking leads to a narrow escape.',
            imagePrompts: Array(9).fill('Placeholder prompt'),
            consequences: 'Safety now, but the challenge remains.',
          },
        ]
        
        return NextResponse.json({
          success: true,
          message: 'Development mode - using mock branches',
          requestId: `dev-${Date.now()}`,
          status: 'ready',
          branches: mockBranches,
          metadata: {
            beatId: body.beatId,
            depth: body.depth || 0,
            parentBranchId: body.parentBranchId,
            generatedAt: new Date().toISOString(),
          }
        } as BranchGenerationResponse)
      }
      
      throw new Error(`N8N Error: ${response.status} - ${errorText}`)
    }
    
    const result = await response.json()
    
    return NextResponse.json({
      success: true,
      ...result,
    })
    
  } catch (error) {
    console.error('Branch Generation Error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Branch generation failed',
      },
      { status: 500 }
    )
  }
}

// GET - Check branch generation status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const requestId = searchParams.get('requestId')
  const beatId = searchParams.get('beatId')
  
  if (!requestId && !beatId) {
    return NextResponse.json({
      message: 'Branch Generation API (Storyception)',
      usage: 'POST with storyId, beatId, beatLabel, and context',
      features: [
        'Generates 3 branch options (A, B, C)',
        'Parallel image generation for all branches',
        'Supports nested branching (inception depth)',
        'Pre-caches images for instant selection',
      ],
      endpoint: N8N_WEBHOOK_BRANCH,
    })
  }
  
  // TODO: Implement branch status/retrieval via NocoDB
  return NextResponse.json({
    requestId,
    beatId,
    status: 'processing',
    message: 'Branch status check not yet implemented',
  })
}
