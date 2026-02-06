# Storyception Architecture

**Last Updated:** 2026-02-06

---

## System Overview

```mermaid
flowchart TD
    subgraph Frontend["Frontend (Next.js)"]
        UI["Setup Panel"] --> GenAPI
        Flow["Flow Canvas\n(React Flow)"] --> BranchAPI
        Flow --> ImgAPI
        Flow --> StatusAPI
    end

    subgraph APIs["API Routes"]
        GenAPI["/api/story/generate\n(Claude Sonnet 4.6)"]
        BranchAPI["/api/story/branches\n(Claude - on demand)"]
        ImgAPI["/api/images/generate\n(fal.ai Nano Banana Pro)"]
        UploadAPI["/api/images/upload\n(Nextcloud WebDAV)"]
        StatusAPI["/api/story/status\n(Poll NocoDB)"]
    end

    subgraph External["External Services"]
        Claude["Anthropic Claude\nSonnet 4.6"]
        Fal["fal.ai\nNano Banana Pro"]
        NC["Nextcloud\n(Image Storage)"]
        NocoDB["NocoDB\n(Database)"]
    end

    GenAPI --> Claude
    GenAPI --> NocoDB
    BranchAPI --> Claude
    BranchAPI --> NocoDB
    ImgAPI --> Fal
    ImgAPI --> NC
    ImgAPI --> NocoDB
    UploadAPI --> NC
    StatusAPI --> NocoDB
    UI --> UploadAPI
```

---

## User Flow

```mermaid
flowchart TD
    Start(("User Opens App")) --> Upload["Upload Reference Image\n(1-3 photos)"]
    Upload --> Pick["Pick Archetype\n+ Outcome"]
    Pick --> Generate["POST /api/story/generate"]
    Generate --> Story["Claude generates story\nbeats + keyframe prompts"]
    Story --> SaveDB["Save to NocoDB:\nSession + Beats + Keyframes"]
    SaveDB --> GenImg1["Generate 1st beat grid\n(fal.ai → Nextcloud → NocoDB)"]
    GenImg1 --> Reveal["Reveal Beat 1\nwith 3x3 keyframe grid"]
    Reveal --> Branch{"Beat has branches?\n(based on weight)"}
    Branch -->|"weight = 0\n(Opening/Closing)"| AutoAdvance["Auto-advance\nto next beat"]
    Branch -->|"weight > 0"| ShowBranch["POST /api/story/branches\nClaude generates\ncontext-aware options"]
    ShowBranch --> UserPick["User picks a path"]
    UserPick --> GenNext["Generate next beat images\n(fal.ai pipeline)"]
    GenNext --> RevealNext["Reveal next beat"]
    RevealNext --> Branch
    AutoAdvance --> GenNext2["Generate next beat images"]
    GenNext2 --> RevealNext
```

---

## Data Flow: Image Generation Pipeline

```mermaid
flowchart LR
    Prompt["9 Keyframe\nPrompts"] --> Fal["fal.ai\nNano Banana Pro"]
    Ref["Reference\nImage URL"] --> Fal
    Fal -->|"1 × 4K image\n(3×3 grid)"| Grid["Grid Image\n(PNG)"]
    Grid --> Sharp["sharp\n(slice into 9)"]
    Sharp --> KF1["KF1"] & KF2["KF2"] & KF3["..."] & KF9["KF9"]
    KF1 & KF2 & KF3 & KF9 --> NC["Upload to\nNextcloud"]
    NC --> Share["Create public\nshare links"]
    Share --> DB["Update NocoDB\nImage URL + Thumbnail\nStatus: ready"]
```

---

## NocoDB Tables

| Table | ID | Purpose |
|---|---|---|
| **Sessions** | `mr4ilxbt1jsqf2l` | One per story. Archetype, outcome, reference image |
| **Beats** | `may145m0gc24nmu` | Story beats with descriptions, prompts, status |
| **Branches** | `mt91qfqomry3bal` | Branch options per beat (generated on demand by Claude) |
| **Keyframes** | `mc5xw2syf1fxek8` | 9 per beat. Prompt, image URL, thumbnail, status |

### Keyframe Status Lifecycle

```mermaid
stateDiagram-v2
    [*] --> pending : Record created with prompt
    pending --> processing : fal.ai call started
    processing --> ready : Image uploaded to Nextcloud, URL saved
    processing --> error : fal.ai or upload failed
    error --> pending : Retry
```

---

## Beat Weight System

Each beat in each archetype has a weight (0.0 - 1.0) that controls branching:

| Weight | Branch Behavior | Count |
|---|---|---|
| **0.0** | No branches (auto-advance) | 0 |
| **0.1 - 0.4** | Rare, subtle hint | 0-2 |
| **0.5 - 0.7** | Sometimes shown | 2 |
| **0.8 - 1.0** | Always shown, encouraged | 2-3 |

Weights are defined per-archetype in `lib/beat-weights.ts`.

Beats marked **loopable** (e.g. "Fun & Games", "Tests, Allies, Enemies") allow the user to explore multiple scenes before continuing.

---

## Branch Generation (On-Demand)

Branches are NOT pre-generated. When the user reaches a beat:

1. Check beat weight → decide if branches appear
2. If yes: `POST /api/story/branches` sends the story context + current beat to Claude
3. Claude generates 2-3 **context-aware** branch options that fit the narrative
4. Branch options saved to NocoDB Branches table
5. User picks one → triggers image generation for next beat

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 + React 19 |
| Package Manager | Bun |
| Styling | Tailwind CSS 4 |
| Flow Visualization | React Flow (@xyflow/react) |
| Animation | Framer Motion |
| LLM (Story) | Anthropic Claude Sonnet 4.6 |
| Image Gen | fal.ai Nano Banana Pro |
| Image Storage | Nextcloud (WebDAV + public shares) |
| Database | NocoDB (self-hosted) |
| Image Processing | sharp (grid slicing + thumbnails) |

---

## Environment Variables

```
ANTHROPIC_API_KEY      # Claude Sonnet 4.6
FAL_KEY                # fal.ai image generation
NOCODB_BASE_URL        # NocoDB instance
NOCODB_API_TOKEN       # NocoDB auth
NOCODB_TABLE_SESSIONS  # mr4ilxbt1jsqf2l
NOCODB_TABLE_BEATS     # may145m0gc24nmu
NOCODB_TABLE_BRANCHES  # mt91qfqomry3bal
NOCODB_TABLE_KEYFRAMES # mc5xw2syf1fxek8
NEXTCLOUD_BASE_URL     # Nextcloud instance
NEXTCLOUD_USERNAME     # WebDAV user
NEXTCLOUD_APP_PASSWORD # Nextcloud app password
NEXTCLOUD_UPLOAD_PATH  # /Storyception
```

---

## Key Files

```
app/
  api/
    story/generate/route.ts   # Story generation (Claude)
    story/branches/route.ts   # On-demand branch gen (Claude) [TODO]
    images/generate/route.ts  # Per-beat image pipeline [TODO]
    images/upload/route.ts    # Reference image upload to Nextcloud
  page.tsx                    # Main app page

components/storyception/
  setup-panel.tsx             # Archetype + image + outcome selection
  flow-canvas.tsx             # React Flow canvas with progressive reveal
  story-canvas.tsx            # Card view (alternative)
  nodes/
    story-beat-node.tsx       # Beat node with 3x3 grid + lightbox
    branch-node.tsx           # Branch option node

lib/
  nocodb.ts                   # NocoDB client (CRUD for all tables)
  beat-weights.ts             # Per-archetype branch weights
  story-generator.ts          # Beat percentages + local branch gen (legacy)
  types.ts                    # TypeScript interfaces
  colors.ts                   # Beat/branch color system
```
