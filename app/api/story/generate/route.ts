import { NextRequest, NextResponse } from 'next/server'
import { StoryWorkflow } from '@/lib/workflows'
import {
  generateSessionId,
  createSession,
  updateSession,
  createBeat,
  bulkCreateKeyframes,
  generateBeatId,
  generateKeyframeId,
  getPersistenceMode,
  getSession,
} from '@/lib/nocodb'
import { archetypes, beatStructures } from '@/lib/data'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      archetypeIndex,
      archetypeName,
      outcomeName,
      referenceImages,
      referenceAssets,
      characters,
      sessionId: requestedSessionId,
    } = body

    // 1. Run the StoryWorkflow
    const beatsDefForPrompt = beatStructures[archetypeIndex] || []
    const workflowResult = await StoryWorkflow.run({
      archetypeName,
      outcomeName,
      referenceImages,
      characters: Array.isArray(characters) ? characters : [],
      beatLabels: beatsDefForPrompt.map((b: { label: string }) => b.label),
    })

    const storyData = workflowResult.PlanStory
    const visualData = workflowResult.GenerateVisuals

    const sessionId =
      typeof requestedSessionId === 'string' && requestedSessionId.trim()
        ? requestedSessionId.trim()
        : generateSessionId()
    const beatsDef = beatsDefForPrompt

    const allBeats = beatsDef.map((beatDef: { label: string }, index: number) => {
      const generated = storyData.beats[index]
      const visualBeat = visualData[index]
      // First 2 beats get generated content + 9 keyframe prompts; the rest stay
      // as skeletons until the user reaches them via branch selection.
      if (generated && index < 2 && generated.scene_description) {
        return {
          id: generateBeatId(sessionId, index),
          label: generated.label || beatDef.label,
          scene_description: generated.scene_description,
          duration_seconds: generated.duration_seconds || 6,
          keyframe_prompts: visualBeat?.keyframe_prompts || generated.keyframe_prompts || [],
          index,
          status: 'pending'
        }
      }
      return {
        id: generateBeatId(sessionId, index),
        label: beatDef.label,
        scene_description: '',
        duration_seconds: 6,
        keyframe_prompts: [],
        index,
        status: 'skeleton'
      }
    })

    // Persist: NocoDB v3 when Storyception tables exist, else `.data/storyception-store.json`.
    const persistenceOptional =
      process.env.NODE_ENV === 'development' ||
      process.env.STORYCEPTION_SKIP_NOCODB === '1'
    let persisted = false

    try {
      const existingSession = await getSession(sessionId)
      if (!existingSession) {
        await createSession({
          sessionId,
          archetype: archetypeName,
          outcome: outcomeName,
          referenceImageUrl: referenceImages?.[0],
          referenceImageBucket: referenceAssets?.[0]?.bucket,
          referenceImageObjectKey: referenceAssets?.[0]?.objectKey,
          referenceStorageProvider: referenceAssets?.[0] ? 'rustfs' : undefined,
          totalBeats: beatsDef.length
        })
      }

      await updateSession(sessionId, {
        storyData: JSON.stringify({
          storySeed: storyData.story_seed,
          outcomeName
        })
      })

      for (const beat of allBeats) {
        await createBeat({
          beatId: beat.id,
          sessionId,
          beatIndex: beat.index,
          beatLabel: beat.label,
          description: beat.scene_description,
          duration: `${beat.duration_seconds}s`,
          percentOfTotal: Math.round((1 / allBeats.length) * 100)
        })

        if (beat.status !== 'skeleton' && beat.keyframe_prompts.length > 0) {
          const keyframes = beat.keyframe_prompts.map((prompt: string, idx: number) => ({
            keyframeId: generateKeyframeId(beat.id, null, idx + 1),
            sessionId,
            beatId: beat.id,
            frameIndex: idx + 1,
            row: Math.floor(idx / 3) + 1,
            col: (idx % 3) + 1,
            prompt
          }))
          await bulkCreateKeyframes(keyframes)
        }
      }
      persisted = true
    } catch (dbErr) {
      if (!persistenceOptional) throw dbErr
      console.warn(
        '[story/generate] NocoDB persistence skipped (dev or STORYCEPTION_SKIP_NOCODB):',
        dbErr
      )
    }

    return NextResponse.json({
      success: true,
      storyId: sessionId,
      title: storyData.story_title,
      logline: storyData.story_logline,
      storySeed: storyData.story_seed,
      beats: allBeats,
      characters: Array.isArray(characters) ? characters : [],
      persistenceBackend: getPersistenceMode(),
      ...(persisted ? {} : { persisted: false }),
    })

  } catch (error) {
    console.error('Story Generation Error:', error)
    const detail = error instanceof Error ? error.message : 'Unknown error'
    const publicError =
      process.env.NODE_ENV === 'development' ? detail : 'Failed to generate story'
    return NextResponse.json({ success: false, error: publicError }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Story Generation API (Google ADK + Gemini)',
    usage: 'POST with archetypeIndex, archetypeName, outcomeName',
    archetypes: archetypes.map((a, i) => ({
      index: i,
      name: a.title,
      categoryId: a.categoryId,
      beats: beatStructures[i]?.length ?? 0,
    })),
    outcomes: ['Happy Ending', 'Tragedy', 'Redemption', 'Ambiguous'],
  })
}
