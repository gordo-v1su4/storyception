/**
 * Progressive Beat Generation API
 *
 * Generates a single beat's content (scene description, plus 9 keyframe prompts
 * when image generation is on) based on the story so far and the player's branch
 * choice. Optionally writes the beat's own next paths in the same call.
 *
 * Called when the user selects a branch.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  updateBeat,
  bulkCreateKeyframes,
  generateKeyframeId,
  createBranch,
  generateBranchId,
} from '@/lib/nocodb'
import { IMAGE_GENERATION_ENABLED } from '@/lib/feature-flags'
import { getBranchNarrativeModel } from '@/lib/gemini-models'
import { generateStoryJson, getStoryTextModelLabel } from '@/lib/story-text-llm'
import type { CharacterRecord } from '@/lib/storyception-schema'
import { CURRENT_ZEITGEIST_DIRECTIVE, CURRENT_VISUAL_DIRECTIVE } from '@/lib/zeitgeist'

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
  characters?: CharacterRecord[]
  /** Also write the 3 choices the player gets at the end of this beat. */
  includeNextPaths?: boolean
}

export interface ProgressiveBeatPath {
  id: number
  title: string
  description: string
  type: string
  duration: string
  selected: boolean
}

export interface ProgressiveBeatResponse {
  success: boolean
  beatId: string
  scene_description: string
  keyframe_prompts: string[]
  duration_seconds: number
  branches?: ProgressiveBeatPath[]
}

export async function POST(request: NextRequest) {
  try {
    const timeoutMs = Number.parseInt(process.env.GEMINI_TIMEOUT_MS ?? '', 10) || 90000
    const body: ProgressiveBeatRequest = await request.json()

    const {
      sessionId, beatId, beatIndex, beatLabel, beatStructureDesc,
      archetypeName, outcomeName, storyTitle, storyLogline, storySeed,
      selectedBranch, previousBeats, characters, includeNextPaths = false,
    } = body

    const storyContext = (Array.isArray(previousBeats) ? previousBeats : []).map((b, i) => {
      let line = `  Beat ${i + 1}: ${b.label} - ${b.description}`
      if (b.selectedBranch) line += ` [Player chose: ${b.selectedBranch}]`
      return line
    }).join('\n')

    const storyCharacters = Array.isArray(characters)
      ? characters.filter((character) => character.kind === 'character')
      : []
    const characterContext = storyCharacters.length > 0
      ? `\nConfirmed character continuity references:\n${storyCharacters
          .map((character, i) => {
            const descriptor = character.descriptor?.trim() || 'no descriptor provided'
            const look = character.look_label?.trim() || 'Default'
            return `  ${i + 1}. ${character.name} — ${descriptor}. Look: ${look}. Preserve this identity and wardrobe continuity.`
          })
          .join('\n')}`
      : ''

    const keyframeRequirement = IMAGE_GENERATION_ENABLED
      ? `
4. Generate exactly 9 keyframe prompts for a 3x3 cinematic grid following this shot progression:
   - KF1: Wide establishing shot
   - KF2: Medium shot introducing characters
   - KF3: Close-up on protagonist's face/emotion
   - KF4: Action or movement shot
   - KF5: Central dramatic moment
   - KF6: Reaction shot
   - KF7: Environmental detail or symbol
   - KF8: Character interaction
   - KF9: Closing moment of the beat

Each keyframe prompt must be a detailed, cinematic description (30-50 words) suitable for AI image generation. Include: camera angle, lighting mood, character actions, atmospheric details.`
      : ''
    const pathsRequirement = includeNextPaths
      ? `
${IMAGE_GENERATION_ENABLED ? '5' : '4'}. Write exactly 3 distinct choices the player faces at the END of this scene ("next_paths"). Each has a short punchy title (3-6 words), a one-sentence description of what the protagonist does, and a type (confrontation, discovery, escape, sacrifice, reversal, or other). They must differ in attitude, action, or risk.`
      : ''
    const jsonFields = [
      `  "scene_description": "Vivid 2-3 sentence scene description continuing from the player's choice..."`,
      `  "duration_seconds": 6`,
      IMAGE_GENERATION_ENABLED &&
        `  "keyframe_prompts": ["KF1: Wide shot...", "KF2: ...", "KF3: ...", "KF4: ...", "KF5: ...", "KF6: ...", "KF7: ...", "KF8: ...", "KF9: ..."]`,
      includeNextPaths &&
        `  "next_paths": [{ "title": "...", "description": "...", "type": "discovery" }, { ... }, { ... }]`,
    ]
      .filter(Boolean)
      .join(',\n')

    const prompt = `You are an expert screenwriter continuing an interactive story.

STORY: "${storyTitle}"
LOGLINE: ${storyLogline}
NARRATIVE DIRECTION: ${storySeed}
STRUCTURE: ${archetypeName}
DESIRED OUTCOME: ${outcomeName}

STORY SO FAR:
${storyContext || '  (This is the beginning of the story)'}${characterContext}

THE PLAYER JUST CHOSE: "${selectedBranch.title}"
${selectedBranch.description}

NOW GENERATE THE NEXT BEAT:
Beat ${beatIndex + 1}: ${beatLabel}
Structure role: ${beatStructureDesc}

${CURRENT_ZEITGEIST_DIRECTIVE}
${CURRENT_VISUAL_DIRECTIVE}

Requirements:
1. The scene MUST continue directly from the player's branch choice — the branch decision should have clear narrative consequences
2. Write a vivid scene description (2-3 sentences) that advances the story
3. Include named characters from the character list when they are relevant, using the exact names and descriptors provided.${keyframeRequirement}${pathsRequirement}

RESPOND IN THIS EXACT JSON FORMAT:
{
${jsonFields}
}

Generate the beat now.`

    let textContent: string
    try {
      textContent = await generateStoryJson({
        prompt,
        system: 'You are an expert screenwriter. Always respond with valid JSON only, no markdown or extra text.',
        geminiModel: getBranchNarrativeModel(),
        temperature: 0.85,
        maxOutputTokens: 2048,
        timeoutMs,
      })
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
          { success: false, error: `${getStoryTextModelLabel()} timed out after ${timeoutMs / 1000}s` },
          { status: 504 }
        )
      }
      throw err
    }

    if (!textContent) {
      return NextResponse.json(
        { success: false, error: `${getStoryTextModelLabel()} returned no text content` },
        { status: 502 }
      )
    }

    let beatData: {
      scene_description: string
      duration_seconds: number
      keyframe_prompts?: string[]
      next_paths?: Array<{ title?: string; description?: string; type?: string }>
    }
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
    const nextPaths = includeNextPaths && Array.isArray(beatData.next_paths)
      ? beatData.next_paths
          .filter((p) => typeof p?.title === 'string' && p.title.trim())
          .slice(0, 3)
      : []

    let persistenceWarning: string | undefined
    const branches: ProgressiveBeatPath[] = []
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

      for (let i = 0; i < nextPaths.length; i++) {
        const path = nextPaths[i]!
        const record = await createBranch({
          branchId: generateBranchId(beatId, i),
          beatId,
          sessionId,
          branchIndex: i,
          branchType: path.type?.trim() || 'narrative',
          title: path.title!.trim(),
          description: path.description?.trim() ?? '',
          duration: '6s',
        })
        branches.push({
          id: record.branch_index,
          title: record.title,
          description: record.description ?? '',
          type: record.branch_type,
          duration: record.duration,
          selected: record.is_selected,
        })
      }

      console.log(`✅ Progressive beat generated: ${beatId} — "${sceneDescription.substring(0, 60)}..."`)
    } catch (nocoErr) {
      console.error('⚠️ Failed to save progressive beat to NocoDB:', nocoErr)
      const nocoMessage = nocoErr instanceof Error ? nocoErr.message : 'Unknown NocoDB error'
      persistenceWarning = nocoMessage
    }

    return NextResponse.json({
      success: true,
      beatId,
      scene_description: sceneDescription,
      keyframe_prompts: keyframePrompts,
      duration_seconds: durationSeconds,
      branches: branches.length > 0
        ? branches
        : nextPaths.map((p, i) => ({
            id: i,
            title: p.title!.trim(),
            description: p.description?.trim() ?? '',
            type: p.type?.trim() || 'narrative',
            duration: '6s',
            selected: false,
          })),
      persistenceWarning,
    })
  } catch (error) {
    console.error('Progressive beat generation error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Beat generation failed' },
      { status: 500 }
    )
  }
}
