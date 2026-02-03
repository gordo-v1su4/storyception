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
        const branches = await getBranchesForBeat(beat['Beat ID'])
        const keyframes = await getKeyframesForBeat(beat['Beat ID'])
        
        return {
          id: beat['Beat Index'],
          beatId: beat['Beat ID'],
          label: beat['Beat Label'],
          desc: beat['Description'] || '',
          generatedIdea: beat['Generated Idea'] || '',
          duration: beat['Duration'],
          percentOfTotal: beat['Percent of Total'],
          status: beat['Status'],
          selectedBranchId: beat['Selected Branch ID'] || null,
          branches: branches.map(b => ({
            id: b['Branch Index'],
            branchId: b['Branch ID'],
            title: b['Title'],
            desc: b['Description'] || '',
            type: b['Branch Type'],
            duration: b['Duration'],
            selected: b['Is Selected'],
            depth: b['Inception Depth'],
          })),
          keyframes: keyframes.map(kf => ({
            index: kf['Frame Index (1-9)'],
            url: kf['Image URL'],
            prompt: kf['Prompt'],
            status: kf['Status'],
          })),
          // Parse keyframes JSON if present
          keyframeUrls: beat['Keyframes (JSON)'] 
            ? JSON.parse(beat['Keyframes (JSON)']) 
            : keyframes.map(kf => kf['Image URL']).filter(Boolean),
        }
      })
    )

    return NextResponse.json({
      success: true,
      sessionId,
      archetype: session['Archetype'],
      outcome: session['Outcome'],
      status: session['Status'],
      currentBeat: session['Current Beat'],
      totalBeats: session['Total Beats'],
      referenceImageUrl: session['Reference Image URL'] || null,
      storyData: session['Story Data (JSON)'] 
        ? JSON.parse(session['Story Data (JSON)']) 
        : null,
      createdAt: session['Created At'],
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
