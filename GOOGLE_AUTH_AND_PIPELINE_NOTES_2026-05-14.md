# Storyception — Google Auth & Pipeline Revelations (2026-05-13 → 2026-05-14)

> Long debug session log. Read this first the next time something feels weird with Gemini auth, the workflow planner, RustFS uploads, or NocoDB persistence. Everything in this file is what we **actually verified**, not what the docs imply.

---

## TL;DR — Current working configuration

```ini
# .env.local
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_GENAI_VERTEX_USE_GCP_PROJECT=1
GOOGLE_CLOUD_PROJECT=<your-project-id>
GOOGLE_CLOUD_LOCATION=global

STORY_WORKFLOW_NARRATIVE_MODEL=flash
STORY_BRANCH_NARRATIVE_MODEL=flash

MEDIA_API_BASE_URL=https://media.v1su4.dev
MEDIA_API_TOKEN=<rustfs gateway token>
STORYCEPTION_MEDIA_BUCKET=storyception
STORYCEPTION_MEDIA_USER_ID=storyception
```

Plus, once per machine:

```bash
gcloud auth application-default login
```

Verified end-to-end on 2026-05-14:

- `POST /api/story/generate` → 200 in ~21s, returns title, logline, seed, 19 beats; beats 1 & 2 each have a scene description + 9 keyframe prompts.
- `POST /api/images/generate` → 200 in ~36s, returns 9 keyframe URLs at `https://s3.v1su4.dev/storyception/sessions/<sid>/<bid>/<ts>-kf-<n>.png`.

---

## 1. The auth story

### What we tried (and why it failed)

| Attempt | Pattern | Result |
| --- | --- | --- |
| Vertex Express w/ user's `AQ.*` Cloud API key | `Client({ apiKey, vertexai: true })` | **401 ACCESS_TOKEN_TYPE_UNSUPPORTED** across every Vertex endpoint, including `global`, `us-central1`, etc. |
| Account-bound key after granting Vertex AI User + Service Usage Consumer IAM | Same `AQ.*` key | Still 401 — IAM doesn't help; the **key-type** is rejected by `PredictionService.generateContent`. |
| AI Studio Developer API w/ same key | `Client({ apiKey })`, no `vertexai` | 401 — the `AQ.*` key isn't a Developer API key either. |
| AI Studio `AIza*` key | `Client({ apiKey })`, no `vertexai` | Worked for `gemini-2.5-flash` but the 3.x preview models we need aren't all routed there. |
| **Vertex + ADC (`gcloud auth application-default login`)** | `Client({ vertexai: true, project, location: 'global' })` | ✅ **Works.** This is what the Colab scripts were implicitly using (Colab seeds ADC for you). |

### Why API keys don't work for our use case

Vertex AI's `PredictionService.generateContent` (the surface the `@google/genai` SDK calls) explicitly does **not** support API keys in 2026. The "account-bound" `AQ.*` keys Google still hands out are an **onboarding bridge** for AI Studio / Vertex Express playground, not a production auth method. The SDK silently retries with the project headers when both are present and logs:

```
The user provided project/location will take precedence over the API key from the environment variables.
```

That log line is the SDK telling us "I'm ignoring the key and using ADC." That's the signal that auth is actually working.

### How the JS SDK decides what to do

`lib/gemini-client.ts` reads three env vars:

- `GOOGLE_GENAI_USE_VERTEXAI` (`true` ⇒ use Vertex; else AI Studio)
- `GOOGLE_GENAI_VERTEX_USE_GCP_PROJECT` (`1` ⇒ ADC project mode; else API-key mode)
- `GOOGLE_GENAI_VERTEX_EXPRESS` (`1` ⇒ force Express even if a project is set)

`lib/adk-env.ts` also nukes `GOOGLE_GENAI_API_KEY` from `process.env` when ADC project mode is active, so the SDK can't accidentally fall back to a key.

---

## 2. The empty-beats bug

After auth was fixed, story generation still came back as:

```json
{ "story_title": "Untitled", "story_logline": "", "story_seed": "", "beats": [...19 skeletons...] }
```

### Root cause

The old `lib/workflows.ts` used `@google/adk`'s `SequentialAgent`, which produced **free-text** output. The post-processor used a brittle `/\{[\s\S]*\}/` regex to extract JSON — when the agent wrapped its response in prose, markdown, code fences, or just structured the JSON slightly differently than expected, the regex dropped to `parsedData = {}` and the route silently fell through to all-skeleton defaults.

### The fix

Replaced the whole ADK Sequential pipeline with a direct `@google/genai` call using **structured output**:

```ts
const res = await ai.models.generateContent({
  model: 'gemini-3-flash-preview',
  contents: prompt,
  config: {
    responseMimeType: 'application/json',
    responseSchema: STORY_RESPONSE_SCHEMA, // declares story_title, logline, seed, beats[].keyframe_prompts[9]
    systemInstruction: 'Always respond with valid JSON. No markdown.',
    temperature: 0.9,
    maxOutputTokens: 8192,
  },
})
const parsed = JSON.parse(res.text)
```

`responseSchema` is enforced by Gemini — no regex, no fallback parser, no markdown wrapping. Same treatment for `BranchWorkflow.run`.

---

## 3. Model quota gotcha

`gemini-3.1-pro-preview` currently returns:

```
429 RESOURCE_EXHAUSTED
Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429
```

on plain calls (no batching, no fancy options). The preview tier is gated tight. `gemini-3-flash-preview` has plenty of headroom and is plenty smart for both narrative planning and branch generation. We default to Flash; flip the env vars to `pro` once preview quota opens up.

The image model (`gemini-3-pro-image-preview`) is separate from this quota and works fine.

---

## 4. RustFS / object-storage URL conventions

The RustFS media gateway expects:

- `POST /api/v1/storage/upload?bucket=<bucket>&path=<folder>` (multipart, header `X-API-Token`)
- Public read URL pattern: `https://s3.v1su4.dev/<bucket>/<folder>/<filename>`

### The bucket-duplication bug

The original folder params passed `storyception/references/...` and `storyception/<sessionId>/<beatId>` — but the gateway already prepends the bucket. We were ending up with **`s3.v1su4.dev/storyception/storyception/...`**.

### The fix

- `lib/object-storage.ts` now has a defensive `normalizeFolder` helper that strips any leading bucket-name segments from the path.
- The image upload + image generate routes now pass clean folders: `references/<batchId>` and `sessions/<sessionId>/<beatId>`.

Verified URL shape:

```
https://s3.v1su4.dev/storyception/sessions/session-1778733337299-arybxb2cv/session-1778733337299-arybxb2cv-beat-0/1778733372012-kf-1.png
```

---

## 5. Persistence — NocoDB vs local file

Currently the app **silently falls back to local file** (`.data/storyception-store.json`) because:

- `NOCODB_BASE_URL` and `NOCODB_BASE_ID` in `.env.local` point at an old NocoDB instance.
- The `NOCODB_API_TOKEN` we have is an MCP-side token (`xc-mcp-token`), not a regular NocoDB API token (`xc-token`). REST endpoints reject it.

To move persistence back to NocoDB once a real `xc-token` is provisioned:

```ini
NOCODB_BASE_URL=https://nocodb.v1su4.dev
NOCODB_BASE_ID=pp23qqevp2igvcy
NOCODB_API_TOKEN=<a real xc-token>
NOCODB_TABLE_SESSIONS=...
NOCODB_TABLE_BEATS=...
NOCODB_TABLE_BRANCHES=...
NOCODB_TABLE_KEYFRAMES=...
```

The startup log line to watch for:

- `[storyception] persistence: nocodb v3 ...` ⇒ Working
- `[storyception] persistence: local file .data/storyception-store.json — set STORYCEPTION_PERSISTENCE=nocodb to force remote` ⇒ Falling back

> ⚠️ When using local file, `reference_image_url` IS retained in the in-memory React state, but inline `data:` URLs are stripped before NocoDB persistence (Long-text column limit). The image keeps showing in the UI because the client doesn't re-fetch from DB during the session.

---

## 6. What we removed / changed (don't be confused by it later)

- **Deleted** `lib/agents.ts` — was the ADK `LlmAgent` / `SequentialAgent` definitions. Nothing imports it anymore.
- **Deleted** `test_scripts/colab_test_scripts/verify_key.py` — was a 1-shot test of `genai.Client(vertexai=True, api_key=AQ.*)` which never worked.
- **Removed** the `@google/adk` npm dependency (was in `package.json`).
- **Rewrote** `lib/workflows.ts` from ADK SequentialAgent + regex parser → direct `@google/genai` with `responseMimeType: 'application/json'` + `responseSchema`.
- **Updated** every Python script in `test_scripts/colab_test_scripts/` that used `vertexai=True, api_key=os.environ["GOOGLE_CLOUD_API_KEY"]` to use `vertexai=True, project=..., location=...` with ADC.
- **Renamed/cleaned** the doc comments in `lib/adk-env.ts` (file kept; the env-var dance still matters for `@google/genai`).
- **Updated** `env.example` and `google_models_names_to_use.md` to point at ADC as the default and link back to this doc.

### What stayed (intentionally)

- `lib/gemini-api-key.ts` — still useful as a "do we have *any* Gemini auth signal?" check (called by `/api/story/beat` and `/api/images/generate`). Returns truthy whenever any of the key envs are set; doesn't actually use the key for the call.
- `lib/adk-env.ts` — name is now a misnomer (we don't use ADK), but the env-var normalization it does for `@google/genai` is still necessary. Keep the file; just read the top doc comment.

---

## 7. How to verify the whole pipeline yourself

```powershell
# 1. Free port 3000
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

# 2. Start dev
bun run dev

# 3. (separate shell) Smoke test
$refUrl = 'https://s3.v1su4.dev/storyception/references/ref-1778732835657/1778732835226-ref-1.png'
$gen = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/story/generate" `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body (@{
    archetypeIndex = 5; archetypeName = 'SONG ARC'; outcomeName = 'TRAGEDY'
    referenceImages = @($refUrl); totalDuration = 90
  } | ConvertTo-Json -Depth 5) -TimeoutSec 240

$beat = $gen.beats[0]
$img = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/images/generate" `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body (@{
    sessionId = $gen.storyId; beatId = $beat.id
    referenceImageUrl = $refUrl; keyframePrompts = $beat.keyframe_prompts
    beatLabel = $beat.label; beatDescription = $beat.scene_description
  } | ConvertTo-Json -Depth 5) -TimeoutSec 240

Start-Process $img.keyframeUrls[0]
```

Expected: story arrives in ~20s with real title/logline + 2 fully populated beats; first beat's 9 keyframe PNGs arrive ~35s later, each at a clean `s3.v1su4.dev/storyception/sessions/...` URL with no path duplication.

---

## 8. References we double-checked

- Google Cloud Vertex AI — supported authentication methods for `aiplatform.googleapis.com` (no API keys for `PredictionService` in 2026).
- `@google/genai` JS SDK README — `Client({ vertexai: true, project, location })` is the canonical Vertex constructor.
- Vertex AI `gemini-3-pro-image-preview` model card — works on `global` location; supports `outputMimeType: 'image/png'`, `aspectRatio: '16:9'`, `imageSize: '2K'`.
- `responseMimeType: 'application/json'` + `responseSchema` semantics — model is forced to emit conforming JSON; no markdown wrapping.
