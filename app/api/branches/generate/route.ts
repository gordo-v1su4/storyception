/**
 * Branch Generation API Route
 *
 * Generates branch options (A, B, C) for a story beat.
 *
 * Default: in-app Gemini (`gemini-3.1-pro-preview`) via {@link generateBranchesWithGemini}
 * — Google Gen AI / Gemini API only (no Vertex in this path).
 *
 * Optional: set STORYCEPTION_BRANCH_USE_N8N=1 to delegate to an n8n webhook
 * (external workflows must also use Google models only if you want a pure-Google stack).
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateBranchesWithGemini } from '@/lib/branch-generation-gemini'

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://n8n.v1su4.dev'
const N8N_WEBHOOK_BRANCH = process.env.N8N_WEBHOOK_BRANCH_GENERATE || '/webhook/branch-generate'

function useN8nForBranches(): boolean {
  return process.env.STORYCEPTION_BRANCH_USE_N8N?.trim() === '1'
}

export interface BranchGenerationRequest {
  storyId: string
  beatId: string
  beatLabel: string
  currentContext: string
  archetype: string
  outcome: string
  depth?: number
  parentBranchId?: string
}

export interface GeneratedBranch {
  id: string
  label: string
  title: string
  description: string
  type: string
  duration: string
  sceneIdea: string
  imagePrompts: string[]
  keyframes?: {
    id: number
    url: string
    prompt: string
  }[]
  consequences: string
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

const SUFFIXES = ['a', 'b', 'c'] as const

export async function POST(request: NextRequest) {
  try {
    const body: BranchGenerationRequest = await request.json()

    if (!body.storyId || !body.beatId) {
      return NextResponse.json({ error: 'storyId and beatId are required' }, { status: 400 })
    }

    const metadataBase = {
      beatId: body.beatId,
      depth: body.depth || 0,
      parentBranchId: body.parentBranchId,
      generatedAt: new Date().toISOString(),
    }

    if (!useN8nForBranches()) {
      const { branches: rows } = await generateBranchesWithGemini({
        beatId: body.beatId,
        beatLabel: body.beatLabel || 'Beat',
        currentContext: body.currentContext || '',
        archetype: body.archetype || 'Story',
        outcome: body.outcome || 'Ambiguous',
      })

      const branches: GeneratedBranch[] = rows.map((r, i) => ({
        id: `${body.beatId}-${SUFFIXES[i] ?? i}`,
        label: r.label,
        title: r.title,
        description: r.description,
        type: r.type,
        duration: r.duration,
        sceneIdea: r.sceneIdea,
        imagePrompts: r.imagePrompts,
        consequences: r.consequences,
      }))

      return NextResponse.json({
        success: true,
        requestId: `gemini-${Date.now()}`,
        status: 'ready',
        branches,
        metadata: metadataBase,
      } satisfies BranchGenerationResponse)
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
        count: 3,
        depth: body.depth || 0,
        parentBranchId: body.parentBranchId,
        generateImages: true,
        parallelImageGeneration: true,
      },
      timestamp: new Date().toISOString(),
    }

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const requestId = searchParams.get('requestId')
  const beatId = searchParams.get('beatId')

  if (!requestId && !beatId) {
    return NextResponse.json({
      message: 'Branch Generation API (Storyception)',
      usage: 'POST with storyId, beatId, beatLabel, and context',
      defaultBackend: 'Gemini in-app (set STORYCEPTION_BRANCH_USE_N8N=1 for n8n webhook)',
      features: [
        'Generates 3 branch options (A, B, C)',
        'Nine image prompts per branch for downstream Gemini image grids',
        'Optional n8n orchestration when STORYCEPTION_BRANCH_USE_N8N=1',
      ],
      n8nWebhook: N8N_WEBHOOK_BRANCH,
    })
  }

  return NextResponse.json({
    requestId,
    beatId,
    status: 'processing',
    message: 'Branch status check not yet implemented',
  })
}
