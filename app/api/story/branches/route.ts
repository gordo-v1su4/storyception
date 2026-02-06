/**
 * On-Demand Branch Generation API
 * 
 * Uses Claude Sonnet 4.6 to generate context-aware branch options
 * for a specific beat, based on the story so far and beat weight.
 * 
 * Branches are saved to NocoDB Branches table.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createBranch, generateBranchId } from '@/lib/nocodb'
import { getBeatWeight, getBranchCount, type BeatWeight } from '@/lib/beat-weights'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

export interface BranchGenRequest {
  sessionId: string
  beatId: string
  beatLabel: string
  beatDescription: string
  archetypeIndex: number
  archetypeBeatId: string  // e.g. "funAndGames", "ordeal"
  storyTitle: string
  storyLogline: string
  previousBeats: Array<{
    label: string
    description: string
    selectedBranch?: string  // Which branch was picked (if any)
  }>
}

export interface GeneratedBranch {
  id: number
  title: string
  description: string
  type: string
  duration: string
  branchId: string
}

export async function POST(request: NextRequest) {
  try {
    const body: BranchGenRequest = await request.json()

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ success: false, error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const {
      sessionId, beatId, beatLabel, beatDescription,
      archetypeIndex, archetypeBeatId,
      storyTitle, storyLogline, previousBeats,
    } = body

    // Check beat weight to determine branch count
    const beatWeight: BeatWeight | null = getBeatWeight(archetypeIndex, archetypeBeatId)
    const weight = beatWeight?.weight ?? 0.5
    const branchCount = getBranchCount(weight)

    if (branchCount === 0) {
      return NextResponse.json({
        success: true,
        branches: [],
        reason: 'Beat weight too low for branching',
        weight,
      })
    }

    // Build context from previous beats
    const storyContext = previousBeats.map((b, i) => {
      let line = `  Beat ${i + 1}: ${b.label} - ${b.description}`
      if (b.selectedBranch) line += ` [Player chose: ${b.selectedBranch}]`
      return line
    }).join('\n')

    const prompt = `You are a master storyteller creating a "Choose Your Own Adventure" experience.

STORY: "${storyTitle}"
LOGLINE: ${storyLogline}

STORY SO FAR:
${storyContext || '  (This is the beginning of the story)'}

CURRENT BEAT: ${beatLabel}
SCENE: ${beatDescription}

Generate exactly ${branchCount} distinct branching path options for the player. Each path should:
1. Flow naturally from the current scene
2. Feel meaningfully different from each other (not just cosmetic changes)
3. Have real narrative consequences
4. Match the tone and genre of the story
5. Be 1-2 sentences describing what happens if this path is chosen

Each branch needs a "type" that describes the narrative approach:
- "confrontation" - direct action or conflict
- "discovery" - investigation, revelation, finding something
- "sacrifice" - giving something up, making a hard choice
- "deception" - trickery, misdirection, hiding truth
- "alliance" - forming bonds, seeking help, diplomacy
- "escape" - fleeing, avoiding, finding a way out
- "introspection" - reflection, memory, inner struggle

RESPOND IN THIS EXACT JSON FORMAT:
{
  "branches": [
    {
      "title": "Short evocative title (3-6 words)",
      "description": "What happens on this path (1-2 sentences)",
      "type": "one of the types above",
      "duration": "+8s"
    }
  ]
}

Generate ${branchCount} compelling, story-specific branches now.`

    const anthropicResp = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: 'You are a master storyteller. Always respond with valid JSON only, no markdown or extra text.',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
      }),
    })

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text()
      console.error('Anthropic branch gen error:', errText)
      return NextResponse.json(
        { success: false, error: `Anthropic API error: ${anthropicResp.status}` },
        { status: 500 }
      )
    }

    const anthropicData = await anthropicResp.json()
    const textContent = anthropicData.content
      ?.filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('') || '{}'

    let branchData: { branches: Array<{ title: string; description: string; type: string; duration: string }> }
    try {
      branchData = JSON.parse(textContent)
    } catch {
      const jsonMatch = textContent.match(/```json\n?([\s\S]*?)\n?```/)
      if (jsonMatch) {
        branchData = JSON.parse(jsonMatch[1])
      } else {
        console.error('Failed to parse branch response:', textContent.substring(0, 300))
        return NextResponse.json({ success: false, error: 'Failed to parse branch response' }, { status: 500 })
      }
    }

    // Save branches to NocoDB and build response
    const branches: GeneratedBranch[] = []
    for (let i = 0; i < (branchData.branches || []).length; i++) {
      const b = branchData.branches[i]
      const branchId = generateBranchId(beatId, i)

      try {
        await createBranch({
          branchId,
          beatId,
          sessionId,
          branchIndex: i,
          branchType: b.type || 'discovery',
          title: b.title,
          description: b.description,
          duration: b.duration || '+8s',
          depth: 0,
        })
      } catch (err) {
        console.error(`Failed to save branch ${branchId}:`, err)
      }

      branches.push({
        id: Date.now() + i,
        title: `PATH ${String.fromCharCode(65 + i)}: ${b.title.toUpperCase()}`,
        description: b.description,
        type: b.type || 'discovery',
        duration: b.duration || '+8s',
        branchId,
      })
    }

    console.log(`✅ Generated ${branches.length} branches for ${beatId} (weight: ${weight})`)

    return NextResponse.json({
      success: true,
      branches,
      weight,
      isLoopable: beatWeight?.isLoopable ?? false,
    })
  } catch (error) {
    console.error('Branch generation error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Branch generation failed' },
      { status: 500 }
    )
  }
}
