# Storyception Current Handoff — Character + Cinematic Grid Pipeline

**Last updated:** 2026-05-16  
**Workspace:** `/Users/robertspaniolo/Documents/Github/storyception`  
**Branch state at update time:** `main...origin/main [ahead 8]` plus uncommitted implementation/docs updates from this handoff pass.

Read this first if another Codex/LLM/computer resumes the work. It points to the source plans and captures exactly what is implemented, what is verified, and what is still blocked.

## Read-order map

1. **Current status / continuation:** this file, `STORYCEPTION_HANDOFF_CURRENT.md`.
2. **Original character-system authority:** `CHARACTER_SYSTEM_HANDOFF_2026-05-14.md`.
3. **Google auth / Vertex pipeline notes:** `GOOGLE_AUTH_AND_PIPELINE_NOTES_2026-05-14.md`.
4. **Approved RALPLAN:** `.omx/plans/ralplan-character-system-handoff-20260515T033126Z.md`.
5. **Team launch / lane history:** `TEAM_EXECUTION_HANDOFF_2026-05-15.md`.
6. **Context snapshot:** `.omx/context/character-system-handoff-20260515T032931Z.md`.

## Current product target

Storyception should feel like a high-end cinematic ideation tool, not a placeholder cartoon generator:

- Sample story/logline content should be current, edge-of-seat, culturally fresh, and suitable for premium film/TV/music-video/commercial work.
- Character sheets should match the supplied premium reference-board caliber: real-actor presence, 4K production sheet, turnaround, head studies, wardrobe/prop details, tactile materials, motivated practical lighting.
- No cardboard cutouts, construction-paper dolls, toy dioramas, flat mascot art, or generic placeholder plots unless explicitly requested.
- Before the canvas stage, the app should return **3 concept pitches/loglines/plots**; the user picks one while character sheets run in the background.
- All multi-frame image outputs must be generated as **one native 4K grid image** and then split:
  - 2x2 option board = one 4K image split into 4 selectable keyframe options.
  - 3x3 storyboard board = one 4K image split into 9 keyframes.

## Implementation status checklist

### Google auth / model access

- [x] Google Cloud ADC login completed locally.
- [x] Active project configured as `project-79-461317`.
- [x] ADC quota project set to `project-79-461317`.
- [x] `.env.local` configured for Vertex AI (`GOOGLE_GENAI_USE_VERTEXAI=true`, project/location, Flash narrative model envs).
- [x] Minimal Vertex Gemini Flash request returned OK.
- [ ] Image-model quota is not reliably available: latest full 3x3 generation hit Vertex `429 RESOURCE_EXHAUSTED`.

### Character system

- [x] `app/api/characters/detect/route.ts` implemented.
- [x] Detection prompt upgraded for production-useful descriptors.
- [x] Detection fallback now classifies likely person/actor/portrait references as `character` instead of leaving them `unknown`.
- [x] `app/api/characters/sheet/route.ts` and `app/api/characters/looksheet/route.ts` were part of the team implementation and are included in smoke route checks.
- [x] Character image utility supports Vertex/ADC and dev inline fallback when `MEDIA_API_TOKEN` is absent.
- [x] Character sheet and look-sheet generation are configured as 4K outputs.
- [x] Character prompt standard updated to the supplied premium reference-board caliber.
- [x] `bun run character:prompt-standard` passes.
- [x] Background character sheet generation starts while the user chooses a pitch.
- [x] If sheet generation fails due quota, UI keeps going with raw reference fallback instead of blocking the story.
- [ ] Multi-look UI remains follow-up; current implementation covers the default look path.

### Pre-canvas pitch gate

- [x] `app/api/story/pitches/route.ts` added.
- [x] `StoryConceptPitch` type added in `lib/types.ts`.
- [x] `StoryWorkflow` and `/api/story/generate` accept the selected `conceptPitch` and treat it as story contract.
- [x] `StoryOpeningPanel` now runs upload/detect/pitches before story generation.
- [x] Pitch modal shows 3 logline/plot/tone/twist options before canvas generation.
- [x] Browser/API evidence: `/api/story/pitches` returned 3 pitches, and the browser flow reached canvas after selecting a pitch.

### Current cinematic content/prompt bar

- [x] `lib/zeitgeist.ts` added with `CURRENT_ZEITGEIST_DIRECTIVE`, `CURRENT_VISUAL_DIRECTIVE`, `CHARACTER_SHEET_STANDARD`, and `FOUR_K_GRID_DIRECTIVE`.
- [x] Branch/story/beat/image prompts include current premium cinematic visual/story directives.
- [x] Archetype examples in `lib/data.ts` and `lib/story-opening-data.ts` were refreshed away from placeholder/cartoony examples.
- [x] Smoke payloads now use premium cinematic Zayn/desert-heir sample content instead of tiny/cardboard-style placeholders.

### 4K grid image pipeline

- [x] `/api/images/generate` explicitly asks Gemini for one native 4K 3x3 storyboard grid, then slices it into 9 frames with `sharp`.
- [x] Multi-reference image plumbing is supported for original refs plus character look sheets/sheets.
- [x] New `/api/images/options` endpoint generates one native 4K 2x2 option board and slices it into 4 option frames.
- [x] `StoryBeat` now tracks `optionFrames` and `selectedOptionIndex`.
- [x] `FlowCanvas` can request 2x2 options and pass the selected option as an extra reference when expanding to the 3x3 board.
- [x] `StoryBeatNode` renders/selects 2x2 option frames before the 3x3 keyframes exist.
- [x] API evidence: `/api/images/options` returned `success: true`, `gridLayout: "2x2"`, and 4 data-URL option frames.
- [ ] Latest `/api/images/generate` 3x3 live call was blocked by Vertex `429 RESOURCE_EXHAUSTED`; code path is implemented but needs quota/retry or later rerun.

### Canvas UI

- [x] Flow canvas receives character records and appends character sheet/look-sheet references to keyframe generation.
- [x] Character lane nodes exist above beats.
- [x] Added compact persistent top-right character reference strip in `FlowCanvas` so characters stay visible while panning/working.
- [x] Character cards show reference/source thumbnails and default-look status.
- [ ] Visual polish of the persistent panel can continue, but the functional persistence is in place.

### Dev/test ergonomics

- [x] `lib/gemini-api-key.ts` now treats Vertex ADC as valid auth even without a Gemini API key.
- [x] `/api/images/upload` dev fallback downsizes inline uploaded references to avoid huge data URLs breaking downstream detection.
- [x] NocoDB/local persistence failures in dev image paths are nonfatal warnings.
- [x] `scripts/character-prompt-standard.ts` added.
- [x] `package.json` has `character:prompt-standard` script.
- [x] `scripts/smoke-test-apis.ts` updated for the new character/premium prompt paths.

## Verification evidence from this implementation pass

- [x] `bun run typecheck` — passed.
- [x] `bun run lint` — passed with 6 existing `<img>` warnings, no errors.
- [x] `bun run character:prompt-standard` — passed.
- [x] Light smoke: `STORYCEPTION_SMOKE_HEAVY=0 SMOKE_BASE_URL=http://127.0.0.1:3000 bun run smoke` — 7 runnable checks passed, 7 skipped.
- [x] `/api/story/pitches` direct call — HTTP 200, 3 pitch objects returned.
- [x] `/api/images/options` direct call — HTTP 200, 4 option frames returned from a 2x2 grid.
- [x] Browser verification — app loaded, pitch modal appeared, character detection worked, selected pitch reached canvas.
- [x] Rendered sample generated at `test_output_1778884649751_5.png`.
- [x] `bun run build` — passed after replacing Google-hosted `next/font/google` imports with offline-safe system font variables.
- [ ] Heavy image smoke is currently blocked by Vertex image `429 RESOURCE_EXHAUSTED`.

## Known blockers / next actions

1. **Image quota blocker:** full 3x3 and character-sheet image generation can hit Vertex `429 RESOURCE_EXHAUSTED`. The 2x2 options call succeeded once; the 3x3 call later failed with 429. Next agent should retry later, reduce concurrency, or check quota.
2. **Lint warnings:** 6 non-blocking `<img>` warnings remain in existing UI image preview components.
3. **Commit/push:** no commit has been made for the latest implementation pass. Review diff, run final gates, then commit with Lore protocol.
4. **Optional polish:** improve persistent character strip aesthetics and complete/verify the click path from selected 2x2 option into 3x3 generation after quota recovers.

## Key changed files in latest implementation pass

- `.gitignore`
- `app/layout.tsx`
- `app/globals.css`
- `app/api/story/pitches/route.ts`
- `app/api/images/options/route.ts`
- `app/api/images/generate/route.ts`
- `app/api/images/upload/route.ts`
- `app/api/characters/_utils.ts`
- `app/api/characters/detect/route.ts`
- `app/api/story/beat/route.ts`
- `app/api/story/generate/route.ts`
- `components/storyception/story-opening-panel.tsx`
- `components/storyception/flow-canvas.tsx`
- `components/storyception/nodes/story-beat-node.tsx`
- `lib/zeitgeist.ts`
- `lib/character-mega-prompt.ts`
- `lib/gemini-api-key.ts`
- `lib/gemini-storyboard-image.ts`
- `lib/branch-generation-gemini.ts`
- `lib/workflows.ts`
- `lib/types.ts`
- `lib/data.ts`
- `lib/story-opening-data.ts`
- `scripts/character-prompt-standard.ts`
- `scripts/smoke-test-apis.ts`
- `package.json`

## Useful commands for next agent

```bash
cd /Users/robertspaniolo/Documents/Github/storyception

git status --short --branch
bun run typecheck
bun run lint
bun run character:prompt-standard
PORT=3000 bun run dev
STORYCEPTION_SMOKE_HEAVY=0 SMOKE_BASE_URL=http://127.0.0.1:3000 bun run smoke
bun run build
```

If testing live image calls, use ADC/Vertex project `project-79-461317` and expect possible image quota 429 until quota recovers.
