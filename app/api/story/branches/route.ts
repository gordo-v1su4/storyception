import { NextRequest, NextResponse } from 'next/server'
import { BranchWorkflow } from '@/lib/workflows'
import { 
  createBranch, 
  generateBranchId,
  getSession,
  updateBeat
} from '@/lib/nocodb'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, beatId, beatLabel, storySeed } = body

    // 1. Run the BranchWorkflow
    const workflowResult = await BranchWorkflow.run({
      sessionId,
      currentBeatLabel: beatLabel,
      storySeed
    })

    const branchData = workflowResult.GenerateBranches

    // 2. Persistence (NocoDB)
    const branches = []
    for (let i = 0; i < branchData.branches.length; i++) {
      const branch = branchData.branches[i]
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
      branches.push(record)
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
