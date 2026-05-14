/**
 * Smoke-test Storyception API routes against a running dev server.
 * Usage: `bun run smoke` (ensure `bun run dev` is up and `.env.local` has keys).
 */
const BASE = (process.env.SMOKE_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')

const TIMEOUT_SHORT = 30_000
const TIMEOUT_LLM = 120_000
const TIMEOUT_IMAGE = 180_000

/** 1×1 PNG */
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

type Row = { name: string; ok: boolean; status: number; detail: string }

function row(name: string, ok: boolean, status: number, detail: string): Row {
  return { name, ok, status, detail }
}

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

  const failed = results.filter((r) => !r.ok)
  console.log('\n=== Storyception API smoke test ===\n')
  for (const r of results) {
    const mark = r.ok ? 'PASS' : 'FAIL'
    console.log(`${mark}  ${r.name}  HTTP ${r.status}  ${r.detail}`)
  }
  console.log('')
  if (failed.length) {
    console.error(`Failed: ${failed.length}/${results.length}`)
    process.exit(1)
  }
  console.log(`All ${results.length} checks passed.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
