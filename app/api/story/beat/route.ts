/**
 * Progressive Beat Generation API
 *
 * Generates a single beat's content (scene description + 9 keyframe prompts)
 * based on the story so far and the player's branch choice.
 *
 * Called when the user selects a branch and the next beat is a skeleton.
 */

import { createPartFromText, createUserContent } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'
import {
  updateBeat,
  bulkCreateKeyframes,
  generateKeyframeId,
} from '@/lib/nocodb'
import { createGeminiClient } from '@/lib/gemini-client'
import { GEMINI_MODEL_PRO } from '@/lib/gemini-models'
import { getGeminiApiKey } from '@/lib/gemini-api-key'

export interface ProgressiveBeatRequest {
  sessionId: string
  beatId: string
  beatIndex: number
  beatLabel: string
  beatStructureDesc: string
  archetypeName: string
  outcomeName: string
  storyTitle: string
  storyLogline: string
  storySeed: string
  selectedBranch: {
    title: string
    description: string
    type: string
  }
  previousBeats: Array<{
    label: string
    description: string
    selectedBranch?: string
  }>
}

export interface ProgressiveBeatResponse {
  success: boolean
  beatId: string
  scene_description: string
  keyframe_prompts: string[]
  duration_seconds: number
}

export async function POST(request: NextRequest) {
  try {
    const timeoutMs = Number.parseInt(process.env.GEMINI_TIMEOUT_MS ?? '', 10) || 45000
    const body: ProgressiveBeatRequest = await request.json()

    if (!getGeminiApiKey()) {
      return NextResponse.json(
        { success: false, error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    const {
      sessionId, beatId, beatIndex, beatLabel, beatStructureDesc,
      archetypeName, outcomeName, storyTitle, storyLogline, storySeed,
      selectedBranch, previousBeats,
    } = body

    const storyContext = previousBeats.map((b, i) => {
      let line = `  Beat ${i + 1}: ${b.label} - ${b.description}`
      if (b.selectedBranch) line += ` [Player chose: ${b.selectedBranch}]`
      return line
    }).join('\n')

    const prompt = `You are an expert screenwriter continuing an interactive story.

STORY: "${storyTitle}"
LOGLINE: ${storyLogline}
NARRATIVE DIRECTION: ${storySeed}
STRUCTURE: ${archetypeName}
DESIRED OUTCOME: ${outcomeName}

STORY SO FAR:
${storyContext || '  (This is the beginning of the story)'}

THE PLAYER JUST CHOSE: "${selectedBranch.title}"
${selectedBranch.description}

NOW GENERATE THE NEXT BEAT:
Beat ${beatIndex + 1}: ${beatLabel}
Structure role: ${beatStructureDesc}

Requirements:
1. The scene MUST continue directly from the player's branch choice — the branch decision should have clear narrative consequences
2. Write a vivid scene description (2-3 sentences) that advances the story
3. Generate exactly 9 keyframe prompts for a 3x3 cinematic grid following this shot progression:
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

RESPOND IN THIS EXACT JSON FORMAT:
{
  "scene_description": "Vivid 2-3 sentence scene description continuing from the player's choice...",
  "duration_seconds": 6,
  "keyframe_prompts": ["KF1: Wide shot...", "KF2: ...", "KF3: ...", "KF4: ...", "KF5: ...", "KF6: ...", "KF7: ...", "KF8: ...", "KF9: ..."]
}

Generate the beat now.`

    const abortSignal = AbortSignal.timeout(timeoutMs)
    const ai = createGeminiClient()

    let textContent: string
    try {
      const res = await ai.models.generateContent({
        model: GEMINI_MODEL_PRO,
        contents: createUserContent(createPartFromText(prompt)),
        config: {
          abortSignal,
          temperature: 0.85,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          systemInstruction: createUserContent(
            createPartFromText(
              'You are an expert screenwriter. Always respond with valid JSON only, no markdown or extra text.'
            )
          ),
        },
      })
      textContent = (res.text ?? '').trim()
    } catch (err) {
      const timedOut =
        err instanceof DOMException
          ? err.name === 'TimeoutError' || err.name === 'AbortError'
          : err instanceof Error &&
            (err.name === 'TimeoutError' ||
              err.name === 'AbortError' ||
              err.message?.includes('timeout') ||
              err.message?.includes('aborted'))
      if (timedOut) {
        return NextResponse.json(
          { success: false, error: `Gemini API timed out after ${timeoutMs / 1000}s` },
          { status: 504 }
        )
      }
      throw err
    }

    if (!textContent) {
      return NextResponse.json(
        { success: false, error: 'Gemini returned no text content' },
        { status: 502 }
      )
    }

    let beatData: { scene_description: string; duration_seconds: number; keyframe_prompts: string[] }
    try {
      beatData = JSON.parse(textContent)
    } catch {
      const jsonMatch = textContent.match(/```json\n?([\s\S]*?)\n?```/)
      if (jsonMatch) {
        try {
          beatData = JSON.parse(jsonMatch[1]!)
        } catch {
          console.error('Failed to parse fenced progressive beat response:', textContent.substring(0, 300))
          return NextResponse.json({ success: false, error: 'Failed to parse beat response JSON' }, { status: 500 })
        }
      } else {
        console.error('Failed to parse progressive beat response:', textContent.substring(0, 300))
        return NextResponse.json({ success: false, error: 'Failed to parse beat response' }, { status: 500 })
      }
    }

    const sceneDescription = beatData.scene_description || ''
    const durationSeconds = beatData.duration_seconds || 6
    const keyframePrompts = (beatData.keyframe_prompts || []).slice(0, 9)

    try {
      await updateBeat(beatId, {
        description: sceneDescription,
        generatedIdea: sceneDescription,
        status: 'pending',
      })

      if (keyframePrompts.length > 0) {
        const keyframes = keyframePrompts.map((kfPrompt: string, idx: number) => ({
          keyframeId: generateKeyframeId(beatId, null, idx + 1),
          sessionId,
          beatId,
          frameIndex: idx + 1,
          row: Math.floor(idx / 3) + 1,
          col: (idx % 3) + 1,
          prompt: kfPrompt,
        }))

        await bulkCreateKeyframes(keyframes)
      }

      console.log(`✅ Progressive beat generated: ${beatId} — "${sceneDescription.substring(0, 60)}..."`)
    } catch (nocoErr) {
      console.error('⚠️ Failed to save progressive beat to NocoDB:', nocoErr)
      const nocoMessage = nocoErr instanceof Error ? nocoErr.message : 'Unknown NocoDB error'
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to persist generated beat data',
          details: nocoMessage,
          beatId,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      beatId,
      scene_description: sceneDescription,
      keyframe_prompts: keyframePrompts,
      duration_seconds: durationSeconds,
    })
  } catch (error) {
    console.error('Progressive beat generation error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Beat generation failed' },
      { status: 500 }
    )
  }
}
