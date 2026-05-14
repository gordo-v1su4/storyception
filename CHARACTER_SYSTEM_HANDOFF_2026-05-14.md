# Storyception — Character System Handoff (2026-05-14)

> **Read this first when resuming.** It captures exactly where the character-sheet
> system was left off, the architectural decisions made, and the explicit next
> steps. Pairs with `GOOGLE_AUTH_AND_PIPELINE_NOTES_2026-05-14.md` (auth + pipeline
> debugging history).

---

## TL;DR — Where we are

The user wants a **first-class character system** layered into the existing
Storyception pipeline so that every uploaded image gets classified, every
confirmed character gets two reference sheets generated, and every downstream
keyframe gets locked to those sheets.

We've completed the **foundational data layer + prompt library**. We have **not
yet** built the API endpoints, the UI flow, or wired the character refs into the
existing image generation pipeline.

### Completed (this session)

1. **Schema** — `lib/storyception-schema.ts`
   - New `CharacterKind = 'character' | 'environment' | 'prop' | 'unknown'`
   - New `CharacterRecord` interface with fields:
     - `character_id`, `session_id`, `name`, `kind`, `descriptor`
     - `source_image_url` (user upload — provenance)
     - `sheet_image_url` (**annotated production board** — Kaito Tanaka style — for humans, on canvas)
     - `look_sheet_image_url` (**clean photo-grid sheet** — Min/Fang style — PRIMARY AI reference for keyframe gen)
     - `look_label` (defaults to `"Default"` — supports multi-look future, e.g. `"Shirtless"`)
     - `mega_prompt`, `created_at`, `nc_row_id`

2. **Local store** — `lib/storyception-local-store.ts`
   - `createCharacterLocal`, `getCharactersForSessionLocal`, `updateCharacterLocal`
   - Falls back here automatically when `NOCODB_TABLE_CHARACTERS` is unset.

3. **NocoDB v3 adapter** — `lib/nocodb-v3.ts`
   - `createCharacterV3`, `getCharactersForSessionV3`, `updateCharacterV3`
   - Reads `NOCODB_TABLE_CHARACTERS` env var. If empty/missing, facade routes to local store.

4. **Facade** — `lib/nocodb.ts`
   - `useCharactersInNoco()`, `createCharacter`, `getCharactersForSession`,
     `updateCharacter`, `generateCharacterId`
   - Graceful local fallback baked in. Same pattern as the other tables.

5. **Mega-prompt library** — `lib/character-mega-prompt.ts`
   - `buildCharacterSheetPrompt(input: CharacterSheetInput)`
     → produces the **annotated Kaito-Tanaka-style production board** prompt
     (text, palette, wardrobe breakdown, turnaround, head studies, cinematic portrait,
     callouts). Adapts STYLE block by `archetypeCategory`.
   - `buildCharacterLookSheetPrompt({ name, descriptor?, wardrobeLabel?, archetypeCategory? })`
     → produces the **clean no-writing photo-grid** prompt (Min/Fang style).
     Enforces: no text, no annotations, no palette blocks. Turnaround strip + head studies +
     detail close-ups + one cinematic close-up. Wardrobe held identical across panels.
   - `wardrobeLabel` parameter is the hook for multi-look ("Default", "Shirtless", "Tuxedo", etc.)

6. **Env** — `.env.local`
   - Added commented placeholder for `NOCODB_TABLE_CHARACTERS`. The user will
     create the table in NocoDB UI manually when ready. Until then, character
     data persists to `.data/storyception-store.json` automatically.

### Cancelled

- ~~`/api/characters/headshot`~~ — dropped. The clean look sheet's head-study
  block + cinematic close-up panel already cover face lock. One fewer image-gen
  call per character. The original `buildCharacterHeadshotPrompt` export was
  replaced with `buildCharacterLookSheetPrompt` in `lib/character-mega-prompt.ts`.

---

## Architectural decisions (DO NOT relitigate)

### Two sheets per character, not one + headshot

The user clarified mid-session (after seeing example references for Min and Fang)
that the right model is **two sheets per character**:

- **Sheet A — Annotated production board** (`sheet_image_url`)
  - Kaito Tanaka style: text annotations, color palette, wardrobe breakdown,
    turnaround, head studies, cinematic portrait, "LEFT COLUMN / CENTER TOP /
    RIGHT COLUMN / WARDROBE / CLOSE-UP POSE" callouts.
  - **For humans** — displayed on the canvas character card as the at-a-glance
    director reference.
  - Passed as a secondary reference into keyframe gen (Gemini ingests the imagery
    portion; the text won't confuse it but adds palette/personality signal).

- **Sheet B — Clean look sheet** (`look_sheet_image_url`)
  - Min / Fang style: NO text, NO annotations, NO palette blocks.
  - Turnaround strip (front, 3/4, side, back) + head-study block (3-4 expressions)
    + detail close-ups (skin, hands, accessories) + ONE cinematic close-up panel
    in motivated location.
  - **PRIMARY AI reference** fed into per-beat keyframe generation. Clean panels
    mean Gemini doesn't read stray typography as content.

### Multi-look support — answered explicitly this turn

User asked: *"if they need a special look shirtless specific tattoos, we'd need
the two... which can be brought up in a session.. need to add another look?"*

**Yes.** The two reference images the user sent (Fang clothed with backpack vs.
Fang shirtless showing tattoos + gold grill expressions) are the canonical
example of why one look per character is insufficient.

**Design (already supported by schema; needs UI + endpoint):**

- `look_label` field already exists on `CharacterRecord`. v1 stores `"Default"`.
- **Future flow:** character card on the canvas has an `[+ Add look]` button.
  - User clicks → modal asks for: look name (e.g. "Shirtless"), short description
    of what's different (e.g. "no shirt, tattoos visible, gold grill expressions"),
    optional new reference image.
  - Backend creates a new `CharacterRecord` row that shares the canonical face via
    `character_id` lineage. Two ways to model:
    - **Option A (v1 — simple):** Re-use `character_id` as a lineage key. Add a
      separate `look_id` to the row, make the unique key `(character_id, look_id)`.
      Requires a small schema migration.
    - **Option B (zero-migration):** Each look is a fully separate `CharacterRecord`
      with its own `character_id` and a `parent_character_id` pointing back.
      Trivially supported by current schema if we add one nullable field.
  - Use **Option B** when implementing — it's a one-field add and avoids
    composite-key gymnastics in NocoDB.
- The per-beat keyframe gen call accepts an array of `(characterId, lookId)` tuples;
  for each, it pulls `look_sheet_image_url` + `sheet_image_url` and concatenates
  them into the reference array sent to Gemini.

**Out of scope for v1 ship.** v1 generates `look_label === "Default"` only.
Multi-look UI is a follow-up task (see todo `multi-look-ui`).

---

## Pending work — in execution order

These map 1:1 to the todo list. Do them in order; each is testable on its own.

### 1. `/api/characters/detect` *(in progress when stopped)*

**Goal:** Receives `{ sessionId, imageUrls: string[] }`. For each image URL,
calls Gemini Flash vision with a JSON schema to classify the subject. Returns
`{ candidates: Array<{ imageUrl, kind: CharacterKind, suggestedName, descriptor, confidence }> }`.

**Notes:**
- Use `gemini-3-flash-preview` (NOT pro — quota issues, vision works fine on Flash).
- Use `responseMimeType: 'application/json'` + `responseSchema` (same pattern as
  `lib/workflows.ts`). Do **not** parse with regex.
- Fetch image bytes server-side from the RustFS URL and pass as `inlineData` parts
  (Gemini Vertex doesn't accept arbitrary HTTPS URLs as image inputs reliably).
- Schema: each candidate must include `kind`, `suggestedName`, `descriptor`,
  `confidence` (0-1). Tell the model "if you cannot tell, return kind='unknown'".
- File path: `app/api/characters/detect/route.ts`

### 2. `/api/characters/sheet`

**Goal:** Receives `{ sessionId, characterId, name, descriptor?, archetypeCategory?, sourceImageUrl }`.
Generates Sheet A (annotated production board).

**Notes:**
- Use `lib/character-mega-prompt.ts` → `buildCharacterSheetPrompt(...)`.
- Use `gemini-3-pro-image-preview`, `outputMimeType: 'image/png'`, `imageSize: '4K'`, `aspectRatio: '16:9'`.
- Fetch sourceImageUrl, attach as inlineData.
- Upload result to RustFS at `sessions/<sessionId>/characters/<characterId>/sheet.png`.
- Call `updateCharacter(characterId, { sheetImageUrl, megaPrompt })`.
- Return `{ sheetImageUrl }`.

### 3. `/api/characters/looksheet` *(was "headshot" — renamed)*

**Goal:** Receives `{ sessionId, characterId, name, descriptor?, wardrobeLabel?, archetypeCategory?, sourceImageUrl }`.
Generates Sheet B (clean photo-grid).

**Notes:**
- Same plumbing as `/sheet` but uses `buildCharacterLookSheetPrompt(...)`.
- Default `wardrobeLabel = "Default"`.
- Upload to `sessions/<sessionId>/characters/<characterId>/looksheet_<wardrobeLabel>.png`.
- Call `updateCharacter(characterId, { lookSheetImageUrl, lookLabel })`.
- Return `{ lookSheetImageUrl, lookLabel }`.

### 4. Refactor `lib/gemini-storyboard-image.ts` + `/api/images/generate` for multi-ref

**Current state:** Only accepts a single `referenceImageUrl`. We need an array.

**Goal:**
- Function signature: `generateStoryboardGridBase64({ prompt, referenceImages: string[], imageSize, aspectRatio })`.
- `referenceImages` can be a mix of HTTPS URLs (fetch + inlineData) or already-base64.
- API route accepts `referenceImages: string[]` in the POST body.
- Also bump `imageSize: '2K'` → `'4K'` per the user's earlier note.

### 5. Extend `StoryWorkflow.run` to accept `characters[]`

**Goal:** `lib/workflows.ts` → `StoryWorkflow.run({ ..., characters: CharacterRecord[] })`.
Inject character names + descriptors into the planner prompt so generated beats
reference them by name and stay consistent.

Also pass character names into the **scene_description** and **keyframe_prompts**
in the schema so the model is forced to mention them.

### 6. Update `/api/story/generate` to receive `characters[]`

**Goal:** Route accepts `characters: CharacterRecord[]` in body, passes to `StoryWorkflow.run`.

### 7. Build `character-confirmation-modal.tsx`

**Goal:** After upload + detect, if `kind === 'character'` candidates exist, show:
> "I found Fang and Min. Should I make character sheets for them?
> *(makes them locked references for every shot — improves consistency dramatically)*"
> [Make sheets] [Skip — use raw refs]

Lets user edit each candidate's name + descriptor + kind before confirming.

### 8. Build `character-card.tsx` for canvas

**Goal:** A card component for the canvas Characters lane. Shows:
- Annotated sheet thumbnail (clickable → full-size modal)
- Name + descriptor
- "Default" look pill + `[+ Add look]` button (button is wired in step 9 multi-look-ui follow-up)
- Source upload thumbnail in corner for provenance

### 9. Wire `setup-panel.tsx` end-to-end

**Goal:** Flow:
1. User uploads images, fills setup form.
2. On submit: call `/api/images/upload` (existing) → get URLs.
3. Call `/api/characters/detect` with those URLs → get candidates.
4. If any candidates are `kind: 'character'` with `confidence > 0.6`: show
   `character-confirmation-modal`.
5. On confirm: for each, in parallel call `/api/characters/sheet` AND
   `/api/characters/looksheet`. Show progress.
6. Once both return: call `/api/story/generate` with `characters` array attached.
7. Canvas now displays the Characters lane with cards + the beats lane below.

### 10. Add Characters lane to `flow-canvas.tsx`

**Goal:** Top lane on the canvas above the beats. Renders `character-card`s.
Each subsequent keyframe gen call automatically passes `[sheetImageUrl, lookSheetImageUrl]`
for every character whose `kind === 'character'`.

### 11. End-to-end smoke test

**Goal:** Update `scripts/smoke-test-apis.ts` to cover the new endpoints. Run
through the full flow with two characters (use Fang clothed + Fang shirtless as
the proof that multi-ref works).

### 12. *(follow-up)* Multi-look UI — `multi-look-ui`

**Goal:** Implement Option B (parent_character_id field) + `[+ Add look]` button
on character card. New look = new row + new looksheet gen. Keyframe gen pulls
`look_sheet_image_url` for the currently-selected look per character per beat.

---

## Decisions log (so we don't re-debate)

| Topic | Decision |
|---|---|
| Auth | Google ADC only. API keys deprecated for Vertex AI's `PredictionService.GenerateContent`. See `GOOGLE_AUTH_AND_PIPELINE_NOTES_2026-05-14.md`. |
| Narrative model | `gemini-3-flash-preview` (Pro hits 429). Env: `STORY_WORKFLOW_NARRATIVE_MODEL=flash`, `STORY_BRANCH_NARRATIVE_MODEL=flash`. |
| Image model | `gemini-3-pro-image-preview`, `outputMimeType: 'image/png'`, `imageSize: '4K'`, `aspectRatio: '16:9'`. |
| Vision model | `gemini-3-flash-preview` for character detection. |
| Structured output | Always `responseMimeType: 'application/json'` + `responseSchema`. Never parse with regex. |
| Persistence | NocoDB v3 when configured, local file fallback otherwise. Characters table is optional (graceful local fallback). |
| RustFS paths | `sessions/<sessionId>/characters/<characterId>/{sheet,looksheet_<label>}.png` |
| Headshot endpoint | **Cancelled.** Look sheet contains close-ups; redundant. |
| Two sheets per character | Annotated (humans) + clean look sheet (AI ref). Both passed to keyframe gen. |
| Multi-look | Supported in schema via `look_label`. v1 ships "Default" only. Follow-up adds `parent_character_id` for sibling looks + `[+ Add look]` UI. |
| ADK | **Removed.** `@google/adk` deleted; everything is direct `@google/genai` now. `lib/adk-env.ts` kept only for env-var wiring. |

---

## Files touched this session

- `lib/storyception-schema.ts` — added `CharacterKind`, `CharacterRecord`, `storyception_characters` table doc.
- `lib/storyception-local-store.ts` — character CRUD.
- `lib/nocodb-v3.ts` — character CRUD via v3 API.
- `lib/nocodb.ts` — facade + `useCharactersInNoco()`.
- `lib/character-mega-prompt.ts` — **new file**. Two prompt builders.
- `.env.local` — `NOCODB_TABLE_CHARACTERS` placeholder.

## Files NOT yet touched (queued for next session)

- `app/api/characters/detect/route.ts` — create
- `app/api/characters/sheet/route.ts` — create
- `app/api/characters/looksheet/route.ts` — create
- `lib/gemini-storyboard-image.ts` — refactor for `referenceImages[]`
- `app/api/images/generate/route.ts` — accept `referenceImages[]`, bump to 4K
- `lib/workflows.ts` — `StoryWorkflow.run({ characters })`
- `app/api/story/generate/route.ts` — receive `characters`
- `components/storyception/character-confirmation-modal.tsx` — create
- `components/storyception/character-card.tsx` — create
- `components/storyception/setup-panel.tsx` — wire flow
- `components/storyception/flow-canvas.tsx` — Characters lane
- `scripts/smoke-test-apis.ts` — extend

---

## Reference images the user provided as the "look standard"

User attached these earlier in the session as the canonical references for what
each sheet should look like:

1. **"Kaito Tanaka" sheet** — the standard for **Sheet A** (annotated production
   board). Text annotations, color palette, wardrobe breakdown, callouts.
2. **"Min" clean photo-grid sheet** — standard for **Sheet B** (clean look sheet).
   Turnaround + 4 head shots + 3 detail close-ups + 1 cinematic close-up. Zero text.
3. **"Fang" clothed sheet** (hooded, backpack, university ID) — Sheet B, "Default" look.
4. **"Fang" shirtless sheet** (tattoos, gold grill, expressions) — Sheet B, "Shirtless" look.
   This is **the proof case for multi-look** — same character, different state,
   different sheet, both feed keyframe gen depending on the beat.

Saved to: `C:\Users\Gordo\.cursor\projects\c-Users-Gordo-Documents-Github-storyception\assets\`
(filenames include the `c__Users_...workspaceStorage...` prefix).

---

## Resume command

When picking this back up, the next concrete action is:

```
Build app/api/characters/detect/route.ts per spec in this doc, section "Pending work — 1".
Then run the dev server (port 3000 via scripts/dev.ts) and verify with a curl POST
of one of the sample reference image URLs.
```

Everything you need to know is in this doc + `GOOGLE_AUTH_AND_PIPELINE_NOTES_2026-05-14.md`.
