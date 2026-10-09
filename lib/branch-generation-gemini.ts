import { getBranchNarrativeModel } from './gemini-models'
import { generateStoryJson, getStoryTextModelLabel } from './story-text-llm'
import { CURRENT_ZEITGEIST_DIRECTIVE, CURRENT_VISUAL_DIRECTIVE } from './zeitgeist'

export type GeminiBranchPlanRow = {
  label: string
  title: string
  description: string
  type: string
  duration: string
  sceneIdea: string
  imagePrompts: string[]
  consequences: string
}

/**
 * In-app branch generation via the narrative provider (Kimi or Gemini — no n8n).
 * Returns three paths with nine image prompts each for optional downstream grid generation.
 */
export async function generateBranchesWithGemini(input: {
  beatId: string
  beatLabel: string
  currentContext: string
  archetype: string
  outcome: string
}): Promise<{ branches: GeminiBranchPlanRow[] }> {
  const prompt = `You are an expert interactive story designer for branching narratives.

Current beat: "${input.beatLabel}"
Archetype: ${input.archetype}
Desired outcome: ${input.outcome}

Story context so far:
${input.currentContext || '(none)'}

${CURRENT_ZEITGEIST_DIRECTIVE}
${CURRENT_VISUAL_DIRECTIVE}

Generate exactly 3 distinct branching paths (A, B, C). Each path must feel like a meaningful player choice.

Return JSON only with this shape:
{
  "branches": [
    {
      "label": "Path A: short label",
      "title": "Dramatic title",
      "description": "2-4 sentences describing what happens if the player takes this path",
      "type": "confrontation|discovery|escape|sacrifice|reversal|other",
      "duration": "6.0s",
      "sceneIdea": "One vivid sentence of the next scene beat",
      "imagePrompts": [
        "KF1: ...", "KF2: ...", "KF3: ...", "KF4: ...", "KF5: ...",
        "KF6: ...", "KF7: ...", "KF8: ...", "KF9: ..."
      ],
      "consequences": "How this choice affects the rest of the arc"
    }
  ]
}

Rules:
- "branches" array length must be exactly 3.
- Each "imagePrompts" must have exactly 9 strings: detailed cinematic shots suitable for AI image generation (camera, lighting, action).`

  const text = await generateStoryJson({
    prompt,
    system: 'You return only valid JSON. No markdown fences or commentary.',
    geminiModel: getBranchNarrativeModel(),
    temperature: 0.85,
    maxOutputTokens: 8192,
    timeoutMs: Number.parseInt(process.env.GEMINI_TIMEOUT_MS ?? '', 10) || 90_000,
  })

  let parsed: { branches?: GeminiBranchPlanRow[] }
  try {
    parsed = JSON.parse(text) as { branches?: GeminiBranchPlanRow[] }
  } catch {
    throw new Error(`Failed to parse branch JSON from ${getStoryTextModelLabel()}`)
  }

  const raw = parsed.branches
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`${getStoryTextModelLabel()} branch response missing branches array`)
  }

  const branches = raw.slice(0, 3).map((b, i) => {
    const base = Array.isArray(b.imagePrompts)
      ? b.imagePrompts.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : []
    let imagePrompts: string[]
    if (base.length === 0) {
      imagePrompts = Array.from(
        { length: 9 },
        (_, j) =>
          `${b.title || b.label || 'Beat'} — cinematic storyboard panel ${j + 1} of 9`
      )
    } else {
      imagePrompts = [...base]
      while (imagePrompts.length < 9) {
        imagePrompts.push(base[imagePrompts.length % base.length]!)
      }
      imagePrompts = imagePrompts.slice(0, 9)
    }
    return {
      label: String(b.label || `Path ${i + 1}`),
      title: String(b.title || b.label || `Branch ${i + 1}`),
      description: String(b.description || ''),
      type: String(b.type || 'narrative'),
      duration: String(b.duration || '6.0s'),
      sceneIdea: String(b.sceneIdea || b.description || ''),
      imagePrompts,
      consequences: String(b.consequences || ''),
    }
  })

  return { branches }
}
