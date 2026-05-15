import { NextRequest, NextResponse } from 'next/server'
import { generateAndStoreCharacterLookSheet, normalizeCharacterKind, requireNonEmptyString } from '../_utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const sessionId = requireNonEmptyString(body.sessionId, 'sessionId')
    const name = requireNonEmptyString(body.name ?? body.suggestedName, 'name')
    const sourceImageUrl = requireNonEmptyString(body.sourceImageUrl ?? body.imageUrl, 'sourceImageUrl')
    const kind = normalizeCharacterKind(body.kind)
    const result = await generateAndStoreCharacterLookSheet({
      sessionId,
      characterId: typeof body.characterId === 'string' ? body.characterId : undefined,
      index: typeof body.index === 'number' ? body.index : undefined,
      name,
      kind,
      descriptor: typeof body.descriptor === 'string' ? body.descriptor : undefined,
      archetypeCategory: body.archetypeCategory,
      sourceImageUrl,
      lookLabel: typeof body.lookLabel === 'string' ? body.lookLabel : undefined,
    })
    return NextResponse.json({
      success: true,
      lookSheetImageUrl: result.lookSheetImageUrl,
      lookLabel: result.lookLabel,
      character: result.character,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate character look sheet'
    const status = /required|image URL/i.test(message) ? 400 : 500
    console.error('Character look sheet error:', error)
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
