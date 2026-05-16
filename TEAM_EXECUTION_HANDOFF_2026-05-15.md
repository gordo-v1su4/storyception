# Team Execution Handoff — Storyception Character System (2026-05-15)


## 2026-05-16 execution update

The fresh team/RALPLAN work has now been implemented directly in the main workspace. Do **not** relaunch the old team command as-is unless intentionally starting a new follow-up pass.

Current continuation source: `STORYCEPTION_HANDOFF_CURRENT.md`.

Completed since this team handoff was written:

- [x] Google ADC/Vertex project `project-79-461317` authenticated and verified.
- [x] Character detect/sheet/looksheet route set is present and smoke route checks see the files.
- [x] Active `StoryOpeningPanel` now performs upload → character detect → 3 pitch generation → background character sheets → selected pitch story generation.
- [x] `app/api/story/pitches/route.ts` added for 3 logline/plot options before canvas.
- [x] Story generation accepts selected concept pitch and character context.
- [x] Character prompts upgraded to 4K premium cinematic production-board standard.
- [x] `lib/zeitgeist.ts` added with current creative/visual standards and grid contract.
- [x] `/api/images/generate` is the 3x3 one-4K-grid-then-slice-to-9 path.
- [x] `/api/images/options` added as the 2x2 one-4K-grid-then-slice-to-4 path.
- [x] `FlowCanvas` includes compact persistent character reference strip and 2x2 option generation/selection plumbing.
- [x] `StoryBeatNode` renders selectable 2x2 option frames before full 3x3 keyframes.
- [x] Verification passed: typecheck, lint with warnings only, character prompt standard, light API smoke, pitch API, 2x2 option API, browser flow to canvas.

Remaining blockers:

- [x] Final `bun run build` rerun passed after removing Google-hosted `next/font/google` and using offline-safe system font variables.
- [ ] Full 3x3 image generation and character-sheet live generation may hit Vertex `429 RESOURCE_EXHAUSTED`; retry after quota recovers or check quota/concurrency.
- [ ] Commit latest implementation/docs with Lore protocol after final gates.

---

## Status

Ready for a fresh-context `$team` launch, but **do not launch until the new window starts**.

## OMX / tmux readiness

- Local OMX: `oh-my-codex v0.17.3`.
- Public OMX site currently advertises `v0.17.0` as the documented release line; local install is newer than that page.
- `npm view oh-my-codex version` was attempted but hung with no output in this restricted session, so npm-registry confirmation is not current.
- `tmux` is installed: `tmux 3.6a`.
- Current session is inside tmux: `$TMUX` was set.
- tmux socket access requires escalated tool permission in this sandbox; `tmux list-panes` succeeded with escalation.
- Previous `omx team ...` launch was interrupted before completion. Follow-up check showed no `.omx/state/team` files.

## Current git baseline

Checkpoint commit created before team work:

```text
6e2b967 Stabilize quality gates before character-system team work
```

Reason: prior ai-slop-cleaner changes restored lint/typecheck/build and removed low-risk slop; committing them prevents team workers from starting on a dirty worktree.

Expected fresh-window check:

```bash
git status --short
git log --oneline -3
```

## Approved plan

Use this plan as the source of truth for team execution:

```text
.omx/plans/ralplan-character-system-handoff-20260515T033126Z.md
```

Context snapshot:

```text
.omx/context/character-system-handoff-20260515T032931Z.md
```

Root handoff authority:

```text
CHARACTER_SYSTEM_HANDOFF_2026-05-14.md
GOOGLE_AUTH_AND_PIPELINE_NOTES_2026-05-14.md
```

Consensus status:

- Architect: ITERATE first draft; required fixes were applied.
- Critic: APPROVE revised plan.
- Team gate: READY, after checkpoint commit.

Critical contract fixes already in the plan:

1. Preallocate/reuse `sessionId` before character detection and sheet generation.
2. Make `referenceImages: string[]` first-class from `StoryOpeningPanel -> app/page.tsx -> FlowCanvas -> /api/images/generate`.
3. Include character context in `/api/story/beat`, not only `/api/story/generate`.
4. Target active `StoryOpeningPanel`; `SetupPanel` appears legacy/unused.
5. Keep multi-look UI as follow-up, not v1.

## Preflight in fresh window

Run these first:

```bash
cd /Users/robertspaniolo/Documents/Github/storyception
omx doctor
tmux -V
printf 'TMUX=%s\n' "$TMUX"
tmux list-panes -F '#{pane_id}\t#{pane_current_command}\t#{pane_start_command}'
git status --short
```

Expected:

- `omx doctor`: healthy or only known non-blocking warnings.
- tmux installed and `$TMUX` non-empty.
- No active/stale `.omx/state/team/*` state.
- Clean git status before team launch.

If stale state exists:

```bash
find .omx/state/team -maxdepth 3 -type f -print | sort | head -100
omx team status <team-name>
```

Do not delete/kill panes unless status proves stale/terminal.

## Team launch command

Launch only from the fresh context window after preflight:

```bash
omx team 5:executor "Implement .omx/plans/ralplan-character-system-handoff-20260515T033126Z.md. Split lanes exactly as plan: worker 1 character APIs; worker 2 image/story plumbing including /api/story/beat; worker 3 active StoryOpeningPanel UI plus app/page state; worker 4 FlowCanvas character lane and keyframe reference consumption; worker 5 smoke/verification. Preserve root handoff decisions, checkpoint evidence, and do not edit outside assigned ownership without reporting conflict."
```

## Worker lane ownership

1. Worker 1 — Character APIs
   - Owns `app/api/characters/detect/route.ts`, `/sheet`, `/looksheet`, shared server helper if needed.

2. Worker 2 — Image + story plumbing
   - Owns `lib/gemini-storyboard-image.ts`, `app/api/images/generate/route.ts`, `lib/workflows.ts`, `app/api/story/generate/route.ts`, `app/api/story/beat/route.ts`, optional `/api/story/branches`.

3. Worker 3 — Active opening UI
   - Owns `components/storyception/story-opening-panel.tsx`, new `character-confirmation-modal.tsx`, and all `app/page.tsx` state threading.

4. Worker 4 — Canvas character lane
   - Owns `components/storyception/character-card.tsx`, `components/storyception/flow-canvas.tsx`, keyframe ref consumption.

5. Worker 5 — Verification / smoke
   - Owns `scripts/smoke-test-apis.ts`, gate commands, final evidence.

## Required gates before team shutdown

```bash
bun run typecheck
bun run lint
bun run build
bun run smoke
```

Heavy Gemini/image smoke may be skipped unless env is present; if skipped, workers must report exact reason and required env.

## Team lifecycle reminders

After launch:

```bash
omx team status <team-name>
# repeat while active, or use await if available
omx team shutdown <team-name>  # only after pending=0, in_progress=0, failed=0 or accepted blocker
```

Do not shut down while workers are writing. Use status/mailbox evidence first.
