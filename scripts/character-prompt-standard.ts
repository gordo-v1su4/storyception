/**
 * Prints the exact character sheet + look-sheet prompts used by the app, plus a
 * lightweight textual quality gate for the current premium-cinematic standard.
 *
 * Usage:
 *   bun run scripts/character-prompt-standard.ts
 */

import { buildCharacterLookSheetPrompt, buildCharacterSheetPrompt } from '../lib/character-mega-prompt'

const descriptor =
  'Award-season antihero lead: controlled, dangerous, emotionally guarded, tactile wardrobe, heirloom prop, real actor presence, premium streaming-series cinematography.'

const prompts = [
  {
    name: 'character sheet',
    text: buildCharacterSheetPrompt({
      name: 'Zayn Amari',
      alias: 'The Heir',
      age: '29',
      height: `6'2" / 188 cm`,
      build: 'lean athletic, upright, stillness under pressure',
      ethnicity: 'Afro-Arab / North African-inspired design language',
      role: 'reluctant heir in a desert-futurist prestige thriller',
      coreTraits: 'disciplined, charismatic, secretive, fiercely loyal',
      emotionalBaseline: 'controlled calm with flashes of intensity',
      wardrobe: 'layered desert royalty, worn tactical textiles, aged gold, heirloom scarf',
      prop: 'ceremonial dagger and signet ring',
      archetypeCategory: 'film-tv',
      quote: 'Power is inherited. Authority has to survive the camera.',
    }),
  },
  {
    name: 'look sheet',
    text: buildCharacterLookSheetPrompt({
      name: 'Zayn Amari',
      descriptor,
      wardrobeLabel: 'Default desert heir look',
      archetypeCategory: 'film-tv',
    }),
  },
]

const requiredSignals = [
  'premium',
  'cinematic',
  'real actor',
  'turnaround',
  '4K',
  'head studies',
  'wardrobe',
  'prop',
  'motivated practical lighting',
  'no cardboard',
  'construction-paper',
]

let failed = false
for (const prompt of prompts) {
  console.log(`\n=== ${prompt.name.toUpperCase()} PROMPT ===\n`)
  console.log(prompt.text)
  const lower = prompt.text.toLowerCase()
  const missing = requiredSignals.filter((signal) => !lower.includes(signal.toLowerCase()))
  if (missing.length) {
    failed = true
    console.error(`\n[FAIL] ${prompt.name} missing signals: ${missing.join(', ')}`)
  } else {
    console.log(`\n[PASS] ${prompt.name} includes premium-cinematic anti-cutout quality signals.`)
  }
}

if (failed) process.exit(1)
