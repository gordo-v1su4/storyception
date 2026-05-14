/**
 * Minimal text→image test using the same client + config as the app.
 * Loads .env.local + .env via Next.js-style precedence.
 * Usage: bun run scripts/test-image-gen.ts ["prompt text"]
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadEnvFile(path: string) {
  if (!existsSync(path)) return
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const k = line.slice(0, eq).trim()
    let v = line.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (k && !(k in process.env)) process.env[k] = v
  }
}

const ROOT = join(import.meta.dir, '..')
loadEnvFile(join(ROOT, '.env.local'))
loadEnvFile(join(ROOT, '.env'))

const { createGeminiClient } = await import('../lib/gemini-client')
const { buildStoryboardImageGenerationConfig } = await import('../lib/gemini-storyboard-image')
const { GEMINI_MODEL_IMAGE } = await import('../lib/gemini-models')
const { createPartFromText, createUserContent } = await import('@google/genai')

const prompt =
  process.argv.slice(2).join(' ').trim() ||
  'A dramatic cinematic shot from a prestige TV series: a lone detective in a rain-soaked neon city alley at night, ' +
    'shallow depth of field, anamorphic lens, 35mm film grain, moody high-contrast lighting, 16:9 widescreen, ' +
    'photoreal, sharp focus on the detective’s face, distant police lights flickering red and blue in the background.'

console.log(`[test-image-gen] model=${GEMINI_MODEL_IMAGE}`)
console.log(`[test-image-gen] prompt=${prompt}`)
console.log(`[test-image-gen] key prefix=${(process.env.GOOGLE_CLOUD_API_KEY ?? '').slice(0, 6) || '(empty)'}...`)

const ai = createGeminiClient()
const t0 = performance.now()

try {
  const res = await ai.models.generateContent({
    model: GEMINI_MODEL_IMAGE,
    contents: createUserContent([createPartFromText(prompt)]),
    config: buildStoryboardImageGenerationConfig(),
  })

  const parts = res.candidates?.[0]?.content?.parts ?? []
  let saved = 0
  for (const [i, p] of parts.entries()) {
    if (p.text) {
      console.log(`[text part ${i}] ${p.text.slice(0, 240)}${p.text.length > 240 ? '…' : ''}`)
    }
    const data = p.inlineData?.data
    if (typeof data === 'string' && data.length > 0) {
      const out = join(ROOT, `test_output_${Date.now()}_${i}.png`)
      writeFileSync(out, Buffer.from(data, 'base64'))
      console.log(`[saved] ${out}  (${(data.length / 1024).toFixed(1)} KiB base64)`)
      saved++
    }
  }
  if (!saved) {
    console.log('[no image] response had no inlineData parts. Full response keys:', Object.keys(res))
  }
  console.log(`[done] ${(performance.now() - t0).toFixed(0)} ms`)
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`[error] ${(performance.now() - t0).toFixed(0)} ms`)
  console.error(msg.slice(0, 1200))
  process.exit(1)
}
