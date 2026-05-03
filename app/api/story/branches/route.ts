import { NextRequest, NextResponse } from 'next/server'
import { BranchWorkflow } from '@/lib/workflows'
import { createBranch, generateBranchId } from '@/lib/nocodb'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      sessionId,
      beatId,
      beatLabel,
      storySeed: storySeedRaw,
      beatDescription,
      storyTitle,
      storyLogline,
      previousBeats,
    } = body

    const storySeed =
      typeof storySeedRaw === 'string' && storySeedRaw.trim()
        ? storySeedRaw
        : [
            storyTitle && `Title: ${storyTitle}`,
            storyLogline && `Logline: ${storyLogline}`,
            beatDescription && `Current beat detail: ${beatDescription}`,
          ]
            .filter(Boolean)
            .join('\n')

    const workflowResult = await BranchWorkflow.run({
      sessionId,
      currentBeatLabel: beatLabel,
      storySeed,
      previousBeats,
    })

    const branchData = workflowResult.GenerateBranches
    const branchList = Array.isArray(branchData?.branches) ? branchData.branches : []

    const branches = []
    for (let i = 0; i < branchList.length; i++) {
      const branch = branchList[i]
      const branchId = generateBranchId(beatId, i)

      const record = await createBranch({
        branchId,
        beatId,
        sessionId,
        branchIndex: i,
        branchType: 'narrative',
        title: branch.label,
        description: branch.outcome_hint,
        duration: '6s'
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

    return NextResponse.json({
      success: true,
      branches
    })

  } catch (error) {
    console.error('Branch Generation Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to generate branches' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Branch Generation API (Google ADK + Gemini)'
  })
}
