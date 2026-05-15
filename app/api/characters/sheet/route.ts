import { NextRequest, NextResponse } from 'next/server'
import { generateAndStoreCharacterSheet, normalizeCharacterKind, requireNonEmptyString } from '../_utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const sessionId = requireNonEmptyString(body.sessionId, 'sessionId')
    const name = requireNonEmptyString(body.name ?? body.suggestedName, 'name')
    const sourceImageUrl = requireNonEmptyString(body.sourceImageUrl ?? body.imageUrl, 'sourceImageUrl')
    const kind = normalizeCharacterKind(body.kind)
    const result = await generateAndStoreCharacterSheet({
      sessionId,
      characterId: typeof body.characterId === 'string' ? body.characterId : undefined,
      index: typeof body.index === 'number' ? body.index : undefined,
      name,
      kind,
      descriptor: typeof body.descriptor === 'string' ? body.descriptor : undefined,
      archetypeCategory: body.archetypeCategory,
      sourceImageUrl,
    })
    return NextResponse.json({ success: true, sheetImageUrl: result.sheetImageUrl, character: result.character })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate character sheet'
    const status = /required|image URL/i.test(message) ? 400 : 500
    console.error('Character sheet error:', error)
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
