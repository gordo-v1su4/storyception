/**
 * Smoke-test Storyception API routes against a running dev server.
 * Usage: `bun run smoke` (ensure `bun run dev` is up and `.env.local` has keys).
 */
import { existsSync } from 'node:fs'

const BASE = (process.env.SMOKE_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')

const TIMEOUT_SHORT = 30_000
const TIMEOUT_LLM = 120_000
const TIMEOUT_IMAGE = 180_000

/** 1×1 PNG */
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

type Row = { name: string; ok: boolean; status: number | 'SKIP' | 'CHECK'; detail: string; skipped?: boolean }

function row(name: string, ok: boolean, status: number | 'CHECK', detail: string): Row {
  return { name, ok, status, detail }
}

function skipRow(name: string, detail: string): Row {
  return { name, ok: true, status: 'SKIP', detail, skipped: true }
}

const HAS_GEMINI_API_KEY = Boolean(
  process.env.GOOGLE_CLOUD_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY
)

const RUN_HEAVY_SMOKE =
  process.env.STORYCEPTION_SMOKE_HEAVY === '0'
    ? false
    : process.env.STORYCEPTION_SMOKE_HEAVY === '1' || HAS_GEMINI_API_KEY
const RUN_CHARACTER_SMOKE = process.env.STORYCEPTION_SMOKE_CHARACTERS === '1'
const RUN_CHARACTER_IMAGE_SMOKE = process.env.STORYCEPTION_SMOKE_CHARACTER_IMAGES === '1'
const SMOKE_REFERENCE_IMAGE_URL = process.env.SMOKE_REFERENCE_IMAGE_URL

const CHARACTER_ROUTE_FILES = [
  'app/api/characters/detect/route.ts',
  'app/api/characters/sheet/route.ts',
  'app/api/characters/looksheet/route.ts',
]

async function fetchJson(
  path: string,
  init?: RequestInit,
  timeoutMs = TIMEOUT_SHORT
): Promise<{ res: Response; json: unknown; text: string }> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, signal: ac.signal })
    const text = await res.text()
    let json: unknown = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    return { res, json, text: text.slice(0, 500) }
  } finally {
    clearTimeout(t)
  }
}

async function main(): Promise<void> {
  const results: Row[] = []

  const missingCharacterRoutes = CHARACTER_ROUTE_FILES.filter((route) => !existsSync(route))
  results.push(
    missingCharacterRoutes.length === 0
      ? row('CHECK character API route files', true, 'CHECK', CHARACTER_ROUTE_FILES.join(', '))
      : skipRow(
          'CHECK character API route files',
          `pending integration: missing ${missingCharacterRoutes.join(', ')}`
        )
  )

  // --- GET: metadata / health-style ---
  {
    const { res, json } = await fetchJson('/api/story/generate')
    const j = json as { archetypes?: unknown }
    results.push(
      row(
        'GET /api/story/generate',
        res.ok && Array.isArray(j?.archetypes),
        res.status,
        res.ok ? `archetypes=${(j?.archetypes as unknown[])?.length ?? 0}` : String(json).slice(0, 200)
      )
    )
  }

  {
    const { res, json } = await fetchJson('/api/story/branches')
    const j = json as { message?: string }
    results.push(row('GET /api/story/branches', res.ok && !!j?.message, res.status, j?.message ?? ''))
  }

  {
    const { res, json } = await fetchJson('/api/branches/generate')
    const j = json as { message?: string }
    results.push(
      row('GET /api/branches/generate', res.ok && !!j?.message, res.status, JSON.stringify(j).slice(0, 200))
    )
  }

  {
    const { res, json } = await fetchJson('/api/n8n')
    const j = json as { message?: string; error?: string }
    results.push(
      row(
        'GET /api/n8n',
        res.ok,
        res.status,
        (j?.message ?? j?.error ?? '').toString().slice(0, 120) || JSON.stringify(json).slice(0, 120)
      )
    )
  }

  {
    const { res, json } = await fetchJson('/api/story/smoke-nonexistent-id-12345')
    const j = json as { success?: boolean; error?: string }
    results.push(
      row(
        'GET /api/story/[sessionId] (expect 404)',
        res.status === 404 && j?.success === false,
        res.status,
        j?.error ?? ''
      )
    )
  }

  // --- POST: Gemini branch pack (no n8n by default) ---
  if (!RUN_HEAVY_SMOKE) {
    results.push(skipRow('POST /api/branches/generate', 'set a Gemini API key or STORYCEPTION_SMOKE_HEAVY=1 to run LLM smoke'))
    results.push(skipRow('POST /api/story/beat', 'set a Gemini API key or STORYCEPTION_SMOKE_HEAVY=1 to run LLM smoke'))
    results.push(skipRow('POST /api/images/generate', 'set a Gemini API key or STORYCEPTION_SMOKE_HEAVY=1 to run image smoke'))
  } else {
  {
    const { res, json } = await fetchJson(
      '/api/branches/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: 'smoke-story',
          beatId: 'smoke-beat-1',
          beatLabel: 'Smoke beat',
          currentContext: 'A hero stands at a fork in the road.',
          archetype: 'Hero journey',
          outcome: 'Happy Ending',
        }),
      },
      TIMEOUT_LLM
    )
    const j = json as { success?: boolean; branches?: unknown[] }
    const ok = res.ok && j?.success === true && Array.isArray(j?.branches) && j.branches.length >= 1
    results.push(
      row(
        'POST /api/branches/generate',
        ok,
        res.status,
        ok ? `branches=${j.branches!.length}` : (typeof json === 'string' ? json : JSON.stringify(json)).slice(0, 250)
      )
    )
  }

  // --- POST: progressive beat ---
  {
    const { res, json } = await fetchJson(
      '/api/story/beat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'smoke-session',
          beatId: 'smoke-beat-next',
          beatIndex: 2,
          beatLabel: 'Rising action',
          beatStructureDesc: 'Obstacles emerge',
          archetypeName: 'Test archetype',
          outcomeName: 'Happy Ending',
          storyTitle: 'Smoke Test Tale',
          storyLogline: 'A test story',
          storySeed: 'Curiosity drives the hero forward',
          selectedBranch: {
            title: 'Take the risky path',
            description: 'The hero chooses danger for a chance at truth',
            type: 'discovery',
          },
          previousBeats: [
            { label: 'Ordinary world', description: 'Quiet morning', selectedBranch: 'Wake up' },
            {
              label: 'Call',
              description: 'A message arrives',
              selectedBranch: 'Take the risky path',
            },
          ],
          characters: [],
        }),
      },
      TIMEOUT_LLM
    )
    const j = json as { success?: boolean; scene_description?: string; keyframe_prompts?: unknown }
    const ok =
      res.ok && j?.success === true && typeof j.scene_description === 'string' && Array.isArray(j.keyframe_prompts)
    results.push(
      row(
        'POST /api/story/beat',
        ok,
        res.status,
        ok
          ? `desc_len=${j.scene_description!.length}, kf=${(j.keyframe_prompts as unknown[]).length}`
          : JSON.stringify(json).slice(0, 280)
      )
    )
  }

  // --- POST: image generate (Gemini image + Media API uploads) ---
  {
    const { res, json } = await fetchJson(
      '/api/images/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'smoke-session',
          beatId: 'smoke-beat-img',
          referenceImageBase64: TINY_PNG_B64,
          referenceImages: [`data:image/png;base64,${TINY_PNG_B64}`],
          beatLabel: 'Smoke',
          beatDescription: 'Test grid',
          keyframePrompts: Array.from(
            { length: 9 },
            (_, i) => `Panel ${i + 1}: abstract color field, soft light, minimal composition`
          ),
        }),
      },
      TIMEOUT_IMAGE
    )
    const j = json as { success?: boolean; keyframeUrls?: unknown[]; error?: string }
    const ok = res.ok && j?.success === true && Array.isArray(j?.keyframeUrls) && j.keyframeUrls!.length === 9
    results.push(
      row(
        'POST /api/images/generate',
        ok,
        res.status,
        ok
          ? `urls=${j.keyframeUrls!.length}`
          : (j?.error ?? JSON.stringify(json)).toString().slice(0, 280)
      )
    )
  }

  }

  // --- POST: multipart upload (dev: data URLs when no MEDIA_API_TOKEN) ---
  {
    const form = new FormData()
    const bytes = Uint8Array.from(Buffer.from(TINY_PNG_B64, 'base64'))
    form.append('images', new Blob([bytes], { type: 'image/png' }), 'smoke.png')
    const { res, json } = await fetchJson('/api/images/upload', { method: 'POST', body: form }, TIMEOUT_SHORT)
    const j = json as { success?: boolean; urls?: unknown[] }
    const ok = res.ok && j?.success === true && Array.isArray(j?.urls) && j.urls!.length >= 1
    results.push(row('POST /api/images/upload', ok, res.status, ok ? `urls=${j.urls!.length}` : String(json).slice(0, 200)))
  }

  // --- POST: ADK story/branches (workflow + optional NocoDB) ---
  if (!RUN_HEAVY_SMOKE) {
    results.push(skipRow('POST /api/story/branches', 'set a Gemini API key or STORYCEPTION_SMOKE_HEAVY=1 to run workflow smoke'))
    results.push(skipRow('POST /api/story/generate', 'set a Gemini API key or STORYCEPTION_SMOKE_HEAVY=1 to run full story smoke'))
  } else {
  {
    const { res, json } = await fetchJson(
      '/api/story/branches',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'smoke-session',
          beatId: 'smoke-beat-br',
          beatLabel: 'Decision point',
          storyTitle: 'Smoke',
          storyLogline: 'Test',
          previousBeats: [],
        }),
      },
      TIMEOUT_LLM
    )
    const j = json as { success?: boolean; branches?: unknown[] }
    const ok = res.ok && j?.success === true && Array.isArray(j?.branches) && j.branches!.length >= 1
    results.push(
      row(
        'POST /api/story/branches',
        ok,
        res.status,
        ok ? `branches=${j.branches!.length}` : JSON.stringify(json).slice(0, 280)
      )
    )
  }

  // --- POST: full story generate (heaviest) ---
  {
    const { res, json } = await fetchJson(
      '/api/story/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archetypeIndex: 0,
          archetypeName: 'Hero Journey',
          outcomeName: 'Happy Ending',
          referenceImages: [],
          characters: [],
        }),
      },
      TIMEOUT_LLM * 2
    )
    const j = json as { success?: boolean; storyId?: string; beats?: unknown[] }
    const ok = res.ok && j?.success === true && typeof j.storyId === 'string' && Array.isArray(j?.beats)
    results.push(
      row(
        'POST /api/story/generate',
        ok,
        res.status,
        ok ? `storyId=${j.storyId} beats=${j.beats!.length}` : JSON.stringify(json).slice(0, 280)
      )
    )
  }

  }

  if (!RUN_CHARACTER_SMOKE) {
    results.push(skipRow('POST /api/characters/detect', 'set STORYCEPTION_SMOKE_CHARACTERS=1 with SMOKE_REFERENCE_IMAGE_URL to run character detection smoke'))
    results.push(skipRow('POST /api/characters/sheet + /looksheet', 'set STORYCEPTION_SMOKE_CHARACTER_IMAGES=1 with SMOKE_REFERENCE_IMAGE_URL to run character image smoke'))
  } else if (missingCharacterRoutes.length > 0) {
    results.push(skipRow('POST /api/characters/*', `character routes not present yet: ${missingCharacterRoutes.join(', ')}`))
  } else if (!RUN_HEAVY_SMOKE || !SMOKE_REFERENCE_IMAGE_URL) {
    results.push(skipRow('POST /api/characters/detect', 'requires Gemini API key plus SMOKE_REFERENCE_IMAGE_URL'))
  } else {
    const sessionId = `smoke-${Date.now()}`
    const characterId = `${sessionId}-character-1`
    const { res, json } = await fetchJson(
      '/api/characters/detect',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, imageUrls: [SMOKE_REFERENCE_IMAGE_URL] }),
      },
      TIMEOUT_LLM
    )
    const j = json as { candidates?: unknown[] }
    const ok = res.ok && Array.isArray(j?.candidates)
    results.push(
      row(
        'POST /api/characters/detect',
        ok,
        res.status,
        ok ? `candidates=${j.candidates!.length}` : JSON.stringify(json).slice(0, 280)
      )
    )

    if (!RUN_CHARACTER_IMAGE_SMOKE) {
      results.push(skipRow('POST /api/characters/sheet + /looksheet', 'set STORYCEPTION_SMOKE_CHARACTER_IMAGES=1 to run image-generation character sheet smoke'))
    } else {
      const commonCharacterBody = {
        sessionId,
        characterId,
        name: 'Smoke Character',
        descriptor: 'A concise smoke-test character descriptor',
        sourceImageUrl: SMOKE_REFERENCE_IMAGE_URL,
      }

      const sheet = await fetchJson(
        '/api/characters/sheet',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(commonCharacterBody),
        },
        TIMEOUT_IMAGE
      )
      const sheetJson = sheet.json as { sheetImageUrl?: string }
      results.push(
        row(
          'POST /api/characters/sheet',
          sheet.res.ok && typeof sheetJson?.sheetImageUrl === 'string',
          sheet.res.status,
          sheetJson?.sheetImageUrl ?? JSON.stringify(sheet.json).slice(0, 280)
        )
      )

      const looksheet = await fetchJson(
        '/api/characters/looksheet',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...commonCharacterBody, wardrobeLabel: 'Default' }),
        },
        TIMEOUT_IMAGE
      )
      const looksheetJson = looksheet.json as { lookSheetImageUrl?: string; lookLabel?: string }
      results.push(
        row(
          'POST /api/characters/looksheet',
          looksheet.res.ok && typeof looksheetJson?.lookSheetImageUrl === 'string',
          looksheet.res.status,
          looksheetJson?.lookLabel ? `${looksheetJson.lookLabel}: ${looksheetJson.lookSheetImageUrl}` : JSON.stringify(looksheet.json).slice(0, 280)
        )
      )
    }
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n=== Storyception API smoke test ===\n')
  for (const r of results) {
    const mark = r.skipped ? 'SKIP' : r.ok ? 'PASS' : 'FAIL'
    const status = typeof r.status === 'number' ? `HTTP ${r.status}` : r.status
    console.log(`${mark}  ${r.name}  ${status}  ${r.detail}`)
  }
  console.log('')
  if (failed.length) {
    console.error(`Failed: ${failed.length}/${results.length}`)
    process.exit(1)
  }
  const skipped = results.filter((r) => r.skipped).length
  console.log(`All ${results.length - skipped} runnable checks passed; ${skipped} skipped.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
