import { Type } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'
import { createGeminiClient } from '@/lib/gemini-client'
import { getBranchNarrativeModel } from '@/lib/gemini-models'
import { CURRENT_ZEITGEIST_DIRECTIVE, CURRENT_VISUAL_DIRECTIVE } from '@/lib/zeitgeist'
import type { StoryConceptPitch } from '@/lib/types'

const PITCH_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: ['pitches'],
  properties: {
    pitches: {
      type: Type.ARRAY,
      minItems: 3,
      maxItems: 3,
      items: {
        type: Type.OBJECT,
        required: ['title', 'logline', 'plot', 'tone', 'twist'],
        properties: {
          title: { type: Type.STRING },
          logline: {
            type: Type.STRING,
            description: 'One sentence, <= 35 words, with protagonist, hook, stakes.',
          },
          plot: {
            type: Type.STRING,
            description: '2-3 sentences describing the pilot/opening idea and escalation.',
          },
          tone: {
            type: Type.STRING,
            description: 'Short tonal lane and current-culture reference bar, not copied IP.',
          },
          twist: {
            type: Type.STRING,
            description: 'One sentence naming the edge-of-seat reversal.',
          },
        },
      },
    },
  },
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const archetypeName = asString(body.archetypeName) || 'Cinematic story'
    const outcomeName = asString(body.outcomeName) || 'Ambiguous'
    const referenceCount = Array.isArray(body.referenceImages) ? body.referenceImages.length : 0
    const characterLines = Array.isArray(body.characterDrafts)
      ? body.characterDrafts
          .slice(0, 3)
          .map((draft: unknown, index: number) => {
            const d = draft && typeof draft === 'object' ? (draft as Record<string, unknown>) : {}
            return `${index + 1}. ${asString(d.name) || 'Unnamed subject'} — ${asString(d.kind) || 'unknown'} — ${
              asString(d.descriptor) || 'no descriptor'
            }`
          })
          .join('\n')
      : ''

    const prompt = `Generate exactly 3 selectable concept pitches before the Storyception canvas is created.

Archetype: ${archetypeName}
Target outcome: ${outcomeName}
Reference images uploaded: ${referenceCount}
Detected subjects:
${characterLines || '(none yet)'}

${CURRENT_ZEITGEIST_DIRECTIVE}
${CURRENT_VISUAL_DIRECTIVE}

Requirements:
- Each pitch must be materially different: different genre lane, pressure system, and central reversal.
- Make each idea feel current, cinematic, high-budget, and useful for judging the later prompt/image quality.
- Use concise, non-infringing taste references only; do not copy protected IP.
- The user will pick one pitch, so logline and plot must be clear enough to choose from.
- Avoid placeholder names like "test hero" and avoid cartoon/cutout aesthetics.

Return ONLY JSON matching the response schema.`

    const ai = createGeminiClient()
    const res = await ai.models.generateContent({
      model: getBranchNarrativeModel(),
      contents: prompt,
      config: {
        temperature: 0.95,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        responseSchema: PITCH_RESPONSE_SCHEMA,
        systemInstruction:
          'You are a premium film/TV/music-video/commercial development producer. Return valid JSON only.',
      },
    })

    const parsed = JSON.parse((res.text ?? '').trim() || '{"pitches":[]}') as {
      pitches?: Array<Partial<StoryConceptPitch>>
    }
    const pitches: StoryConceptPitch[] = (Array.isArray(parsed.pitches) ? parsed.pitches : [])
      .slice(0, 3)
      .map((pitch, index) => ({
        id: `pitch-${index + 1}`,
        title: asString(pitch.title) || `Pitch ${index + 1}`,
        logline: asString(pitch.logline),
        plot: asString(pitch.plot),
        tone: asString(pitch.tone),
        twist: asString(pitch.twist),
      }))

    if (pitches.length !== 3) {
      throw new Error(`Expected 3 pitches, got ${pitches.length}`)
    }

    return NextResponse.json({ success: true, pitches })
  } catch (error) {
    console.error('Story pitch generation error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate story pitches'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
