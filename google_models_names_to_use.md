# Google Gemini — model & API reference

Quick reference for Gemini 3 model IDs, multimodal `media_resolution`, Python snippets, prompting notes, and JS/TS SDK links.

---

## Model IDs

| Model | API model ID | Notes |
|--------|----------------|--------|
| Gemini 3.1 Pro Preview | `gemini-3.1-pro-preview` | Multimodal + streaming (see capabilities below). |
| Gemini 3 Flash Preview | `gemini-3-flash-preview` | Available **only** on **`global`** endpoints. |
| Nano Banana Pro (image generation) | `gemini-3-pro-image-preview` | Use this model ID for Nano Banana Pro image gen. |

### Gemini 3.1 Pro Preview — capabilities

- Image understanding  
- Video understanding  
- Audio understanding  
- Document understanding  
- Streaming  

---

## `media_resolution` (Gemini 3)

Gemini 3 exposes granular control over multimodal vision via **`media_resolution`**. Higher resolution improves fine text and small-detail perception but increases **tokens**, **latency**, and cost. It caps how many tokens are allocated per input **image**, **PDF page**, or **video frame**.

**Levels**

- **`low`**, **`medium`**, **`high`** — can be set **globally** (`generation_config` / `GenerateContentConfig`) **or** per media `Part`.  
- **`ultra_high`** — **only** on **individual** media parts (not as the sole global default for all parts in the same way as the others; set per part when needed).  
- If omitted, the model picks sensible defaults by media type.

---

## Token counts (approximate)

Estimates by **`media_resolution`** and media type. Actual billed usage appears in the response’s **`usage_metadata`** after the call; **`count_tokens`** may not match final multimodal consumption.

| Media resolution | Image | Video (per frame) | PDF |
|------------------|-------|-------------------|-----|
| UNSPECIFIED (default) | 1120 | 70 | 560 |
| LOW | 280 | 70 | 280 + text |
| MEDIUM | 560 | 70 | 560 + text |
| HIGH | 1120 | 280 | 1120 + text |
| ULTRA_HIGH | 2240 | N/A | N/A |

### Recommended settings

| Resolution | Max tokens (image) | When to use |
|------------|-------------------|-------------|
| `ultra_high` | 2240 | Fine detail: screenshots, high-res photos, small UI text. |
| `high` | 1120 | Strong image quality for analysis. |
| `medium` | 560 | Balanced detail vs cost/latency. |
| `low` | 280 (image); video frames max **70** | Most tasks; cheapest/l fastest for simple visuals. |

For video, **`low`** means up to **70 tokens per frame** — tune downward if context window or budget is tight.

---

## Python (`google-genai`) — examples

### Per-part `media_resolution`

```python
from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents=[
        types.Part(
            file_data=types.FileData(
                file_uri="gs://cloud-samples-data/generative-ai/image/a-man-and-a-dog.png",
                mime_type="image/jpeg",
            ),
            media_resolution=types.PartMediaResolution(
                level=types.PartMediaResolutionLevel.MEDIA_RESOLUTION_HIGH,
            ),
        ),
        types.Part(
            file_data=types.FileData(
                file_uri="gs://cloud-samples-data/generative-ai/video/behind_the_scenes_pixel.mp4",
                mime_type="video/mp4",
            ),
            media_resolution=types.PartMediaResolution(
                level=types.PartMediaResolutionLevel.MEDIA_RESOLUTION_LOW,
            ),
        ),
        "When does the image appear in the video? What is the context?",
    ],
)
print(response.text)
```

### Global `media_resolution` in config

```python
from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents=[
        types.Part(
            file_data=types.FileData(
                file_uri="gs://cloud-samples-data/generative-ai/image/a-man-and-a-dog.png",
                mime_type="image/jpeg",
            ),
        ),
        "What is in the image?",
    ],
    config=types.GenerateContentConfig(
        media_resolution=types.MediaResolution.MEDIA_RESOLUTION_HIGH,
    ),
)
print(response.text)
```

---

## Prompting — Gemini 3 (reasoning-oriented)

- **Be direct** — Short, precise instructions work better than long “classic” prompt hacks; verbosity can trigger over-analysis.  
- **Verbosity** — Default answers tend to be concise. Ask explicitly for a chatty or pedagogical tone if you need it.  
- **Grounding** — For strict context-only answers, use explicit system/developer instructions that forbid extrapolation beyond the provided context and require “not available” when the context does not contain the answer.  
- **Google Search tool** — Gemini 3 Flash can mis-handle **year** in search queries. Put **current date and year** in system instructions for time-sensitive queries so tool calls use the right period (refresh this when your app ships; do not rely on a stale year string).  
- **Knowledge cutoff** — When Search is off and answers depend on parametric knowledge, state the model’s **knowledge cutoff** in system instructions per current Google documentation (e.g. if docs say January 2025, mirror that; verify against the model card/release notes you target).  
- **`media_resolution`** — Raise for detail-heavy images/video frames; lower for cost/latency on simple visuals.  
- **Video** — For fast motion or fine temporal structure, prefer **higher FPS sampling** where the API allows it.

---

## TypeScript / JavaScript SDK

- **Docs:** [Google Gen AI SDK for JavaScript/TypeScript](https://googleapis.github.io/js-genai/)  
- Supports **Gemini Developer API** and **Gemini Enterprise Agent Platform** (per Google’s SDK description).

---

## Packages to avoid

- **`@google-cloud/vertexai`** — **Do not use** for new work; **deprecated May 2026** (prefer the current Gen AI SDK stack aligned with your deployment path).
