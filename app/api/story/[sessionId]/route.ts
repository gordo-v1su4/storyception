/**
 * Story Session API Route
 * 
 * GET /api/story/[sessionId] - Load an existing story session
 * PATCH /api/story/[sessionId] - Update session progress
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getSession, 
  getBeatsForSession, 
  updateSession,
  getBranchesForBeat,
  getKeyframesForBeat
} from '@/lib/nocodb'

interface RouteParams {
  params: Promise<{ sessionId: string }>
}

const normalizeKeyframeUrls = (parsed: unknown): string[] => {
  const values = Array.isArray(parsed)
    ? parsed
    : (
        parsed &&
        typeof parsed === 'object' &&
        'keyframes' in parsed &&
        Array.isArray((parsed as { keyframes?: unknown[] }).keyframes)
      )
      ? (parsed as { keyframes: unknown[] }).keyframes
      : []

  return values
    .map((item) => {
      if (typeof item === 'string') return item
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      if (typeof record.url === 'string') return record.url
      if (typeof record.image === 'string') return record.image
      if (typeof record.image_url === 'string') return record.image_url
      if (typeof record['Image URL'] === 'string') return record['Image URL']
      return null
    })
    .filter((url): url is string => Boolean(url))
}

// GET - Load existing story session
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { sessionId } = await params

    // Get session from NocoDB
    const session = await getSession(sessionId)
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }

    // Get all beats for this session
    const beats = await getBeatsForSession(sessionId)

    // Enrich beats with branches and keyframes
    const enrichedBeats = await Promise.all(
      beats.map(async (beat) => {
        const branches = await getBranchesForBeat(beat.beat_id)
        const keyframes = await getKeyframesForBeat(beat.beat_id)

        return {
          id: beat.beat_index,
          beatId: beat.beat_id,
          label: beat.beat_label,
          desc: beat.description || '',
          generatedIdea: beat.generated_idea || '',
          duration: beat.duration,
          percentOfTotal: beat.percent_of_total,
          status: beat.status,
          selectedBranchId: beat.selected_branch_id || null,
          branches: branches.map(b => ({
            id: b.branch_index,
            branchId: b.branch_id,
            title: b.title,
            desc: b.description || '',
            type: b.branch_type,
            duration: b.duration,
            selected: b.is_selected,
            depth: b.inception_depth,
          })),
          keyframes: keyframes.map(kf => ({
            index: kf.frame_index,
            url: kf.image_url,
            prompt: kf.prompt,
            status: kf.status,
          })),
          // Parse keyframes JSON — may be { gridUrl, keyframes: [...] } or raw array
          keyframeUrls: (() => {
            if (beat.keyframes_json) {
              try {
                const parsed = JSON.parse(beat.keyframes_json)
                const normalized = normalizeKeyframeUrls(parsed)
                if (normalized.length > 0) return normalized
              } catch { /* fall through */ }
            }
            return keyframes.map(kf => kf.image_url).filter(Boolean)
          })(),
        }
      })
    )

    return NextResponse.json({
      success: true,
      sessionId,
      archetype: session.archetype,
      outcome: session.outcome,
      status: session.status,
      currentBeat: session.current_beat,
      totalBeats: session.total_beats,
      referenceImageUrl: session.reference_image_url || null,
      storyData: session.story_data_json
        ? JSON.parse(session.story_data_json)
        : null,
      createdAt: session.created_at,
      beats: enrichedBeats,
    })
  } catch (error) {
    console.error('Error loading story session:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to load session' 
      },
      { status: 500 }
    )
  }
}

// PATCH - Update session progress
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { sessionId } = await params
    const body = await request.json()

    // Validate session exists
    const session = await getSession(sessionId)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }

    // Update session with provided fields
    const updates: {
      status?: 'active' | 'completed' | 'abandoned'
      currentBeat?: number
      storyData?: string
    } = {}

    if (body.status) updates.status = body.status
    if (body.currentBeat) updates.currentBeat = body.currentBeat
    if (body.storyData) updates.storyData = JSON.stringify(body.storyData)

    await updateSession(sessionId, updates)

    return NextResponse.json({
      success: true,
      sessionId,
      updated: Object.keys(updates),
    })
  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update session' 
      },
      { status: 500 }
    )
  }
}
