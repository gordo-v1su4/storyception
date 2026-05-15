/**
 * Storyception narrative workflows. Calls Gemini directly via `@google/genai`
 * with `responseMimeType: 'application/json'` + a `responseSchema` for reliable
 * structured output.
 *
 * Previously these went through the `@google/adk` SequentialAgent and parsed
 * the agent's free-text reply with a brittle `/\{[\s\S]*\}/` regex. That
 * regex extract silently dropped to `{}` on any prose/markdown wrapping,
 * which is why beats were coming back with empty `scene_description` for
 * every session even when auth was working.
 *
 * See `GOOGLE_AUTH_AND_PIPELINE_NOTES_2026-05-14.md` for the full back-story.
 */

import './adk-env'
import { Type } from '@google/genai'
import { createGeminiClient } from './gemini-client'
import { getBranchNarrativeModel, getInitialStoryNarrativeModel } from './gemini-models'

const STORY_TIMEOUT_MS =
  Number.parseInt(process.env.GEMINI_TIMEOUT_MS ?? '', 10) || 90_000

const SYSTEM_INSTRUCTION_STORY = `You are an award-winning screenwriter and interactive narrative designer.
Always respond with valid JSON matching the provided schema. No markdown, no code fences, no prose around the JSON.`

const SYSTEM_INSTRUCTION_BRANCH = `You are an expert interactive narrative designer.
Always respond with valid JSON matching the provided schema. No markdown, no code fences, no prose around the JSON.`

const STORY_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: ['story_title', 'story_logline', 'story_seed', 'beats'],
  properties: {
    story_title: { type: Type.STRING, description: 'A short, evocative title.' },
    story_logline: {
      type: Type.STRING,
      description: 'One-sentence hook (≤ 30 words) capturing the central conflict.',
    },
    story_seed: {
      type: Type.STRING,
      description:
        'A 2–3 sentence narrative direction — the through-line that anchors all beats.',
    },
    beats: {
      type: Type.ARRAY,
      minItems: 2,
      maxItems: 2,
      items: {
        type: Type.OBJECT,
        required: ['label', 'scene_description', 'duration_seconds', 'keyframe_prompts'],
        properties: {
          label: { type: Type.STRING },
          scene_description: {
            type: Type.STRING,
            description: 'Vivid 2–3 sentence scene description.',
          },
          duration_seconds: { type: Type.NUMBER },
          keyframe_prompts: {
            type: Type.ARRAY,
            minItems: 9,
            maxItems: 9,
            items: {
              type: Type.STRING,
              description:
                'A 30–50 word cinematic prompt for one of 9 storyboard frames (3×3 grid).',
            },
          },
        },
      },
    },
  },
}

const BRANCH_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: ['branches'],
  properties: {
    branches: {
      type: Type.ARRAY,
      minItems: 2,
      maxItems: 3,
      items: {
        type: Type.OBJECT,
        required: ['label', 'outcome_hint'],
        properties: {
          label: {
            type: Type.STRING,
            description: 'Short verb-phrase title for the choice (≤ 6 words).',
          },
          outcome_hint: {
            type: Type.STRING,
            description: 'One sentence describing where this path leads.',
          },
        },
      },
    },
  },
}

export interface PlannedBeat {
  label: string
  scene_description: string
  duration_seconds: number
  keyframe_prompts: string[]
}

export interface StoryWorkflowInput {
  archetypeName: string
  outcomeName: string
  referenceImageUrl?: string
  referenceImages?: string[]
  beatLabels?: string[]
}

export interface StoryWorkflowResult {
  message: string
  PlanStory: {
    story_title: string
    story_logline: string
    story_seed: string
    beats: PlannedBeat[]
  }
  GenerateVisuals: PlannedBeat[]
}

export const StoryWorkflow = {
  async run(input: StoryWorkflowInput): Promise<StoryWorkflowResult> {
    const referenceLine =
      input.referenceImageUrl || input.referenceImages?.[0]
        ? `\nReference image (visual anchor for tone, lighting, palette): ${
            input.referenceImageUrl || input.referenceImages?.[0]
          }`
        : ''

    const beatLabelsLine = input.beatLabels?.length
      ? `\nThe overall archetype has these beat labels in order (you are only writing the first 2):\n${input.beatLabels
          .map((l, i) => `  ${i + 1}. ${l}`)
          .join('\n')}`
      : ''

    const prompt = `Plan the opening of an interactive cinematic short.

Archetype: ${input.archetypeName}
Target outcome: ${input.outcomeName}${beatLabelsLine}${referenceLine}

Write:
1. A short, evocative story_title.
2. A one-sentence story_logline (≤ 30 words).
3. A 2–3 sentence story_seed that establishes the protagonist, world, and core tension — this is the through-line all later beats will follow.
4. The first 2 beats. For each beat provide a vivid scene_description and exactly 9 keyframe_prompts following this cinematic order:
   KF1 Wide establishing shot · KF2 Medium introducing characters · KF3 Close-up on protagonist · KF4 Action / movement · KF5 Central dramatic moment · KF6 Reaction · KF7 Environmental detail · KF8 Character interaction · KF9 Closing moment.
   Each keyframe_prompt is 30–50 words and includes camera angle, lighting, character action, atmosphere.

Respond ONLY with JSON matching the response schema.`

    const model = getInitialStoryNarrativeModel()
    const ai = createGeminiClient()
    const abortSignal = AbortSignal.timeout(STORY_TIMEOUT_MS)

    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        abortSignal,
        temperature: 0.9,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: STORY_RESPONSE_SCHEMA,
        systemInstruction: SYSTEM_INSTRUCTION_STORY,
      },
    })

    const text = (res.text ?? '').trim()
    if (!text) {
      throw new Error('Gemini returned empty response for story planning')
    }

    let parsed: {
      story_title?: string
      story_logline?: string
      story_seed?: string
      beats?: PlannedBeat[]
    }
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      console.error('StoryWorkflow JSON parse failed. Raw response head:', text.slice(0, 400))
      throw new Error(
        `Gemini returned non-JSON despite responseMimeType=application/json: ${(e as Error).message}`
      )
    }

    const beats = Array.isArray(parsed.beats) ? parsed.beats.slice(0, 2) : []

    return {
      message: 'Workflow completed successfully',
      PlanStory: {
        story_title: parsed.story_title || 'Untitled',
        story_logline: parsed.story_logline || '',
        story_seed: parsed.story_seed || '',
        beats,
      },
      GenerateVisuals: beats,
    }
  },
}

export interface BranchWorkflowInput {
  sessionId?: string
  currentBeatLabel?: string
  storySeed?: string
  previousBeats?: Array<{
    label?: string
    description?: string
    selectedBranch?: string
  }>
}

export interface BranchWorkflowResult {
  message: string
  GenerateNextBeat: unknown
  GenerateNextVisuals: unknown
  GenerateBranches: { branches: Array<{ label: string; outcome_hint: string }> }
}

export const BranchWorkflow = {
  async run(input: BranchWorkflowInput): Promise<BranchWorkflowResult> {
    const previous =
      Array.isArray(input.previousBeats) && input.previousBeats.length > 0
        ? input.previousBeats
            .map(
              (b, i) =>
                `  Beat ${i + 1}: ${b.label ?? ''} — ${b.description ?? ''}` +
                (b.selectedBranch ? ` (player chose: ${b.selectedBranch})` : '')
            )
            .join('\n')
        : '  (no prior beats — this is the opening branch)'

    const prompt = `Generate 2–3 distinct branching choices for the player at the current beat.

Story context: ${input.storySeed || '(none)'}
Current beat: ${input.currentBeatLabel || '(unspecified)'}

Earlier beats so far:
${previous}

Each branch is a meaningful narrative choice the player can take. Branches must feel distinct (different attitude, action, or risk profile) and align with the natural flow of this story. Return ONLY JSON matching the response schema.`

    const model = getBranchNarrativeModel()
    const ai = createGeminiClient()
    const abortSignal = AbortSignal.timeout(STORY_TIMEOUT_MS)

    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        abortSignal,
        temperature: 0.85,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema: BRANCH_RESPONSE_SCHEMA,
        systemInstruction: SYSTEM_INSTRUCTION_BRANCH,
      },
    })

    const text = (res.text ?? '').trim()
    let parsed: { branches?: Array<{ label?: string; outcome_hint?: string }> } = {}
    if (text) {
      try {
        parsed = JSON.parse(text)
      } catch {
        console.error('BranchWorkflow JSON parse failed. Raw head:', text.slice(0, 300))
      }
    }

    const branches = Array.isArray(parsed.branches)
      ? parsed.branches
          .map((b, i) => ({
            label: (b.label || `Path ${i + 1}`).toString(),
            outcome_hint: (b.outcome_hint || '').toString(),
          }))
          .filter((b) => b.label || b.outcome_hint)
      : []

    const defaultBranches = [
      { label: 'Direct confrontation', outcome_hint: 'Face the conflict head-on.' },
      { label: 'Seek another way', outcome_hint: 'Find a clever or hidden path forward.' },
      { label: 'Step back and observe', outcome_hint: 'Gather information before committing.' },
    ]
    const generatedBranches = branches.length > 0 ? branches : defaultBranches

    if (branches.length === 0) {
      console.warn(
        'BranchWorkflow used default branches because Gemini returned no usable branches.',
        { hasText: text.length > 0, rawHead: text.slice(0, 300) }
      )
    }

    return {
      message: 'Branch workflow completed successfully',
      GenerateNextBeat: parsed,
      GenerateNextVisuals: parsed,
      GenerateBranches: { branches: generatedBranches },
    }
  },
}
