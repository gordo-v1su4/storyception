"""
Standalone reference: minimal Python script that mirrors how Storyception talks to
Gemini in 2026. Run this if you want to sanity-check that your local credentials
can hit `gemini-3-pro-image-preview` without any of the Next.js plumbing.

⚠️ HISTORICAL NOTE (2026-05-13)
   Earlier revisions of this file used:
       genai.Client(vertexai=True, api_key=<GOOGLE_CLOUD_API_KEY>)
   That pattern does NOT work against Vertex AI's PredictionService anymore.
   Vertex `generateContent` rejects API keys with
       401 ACCESS_TOKEN_TYPE_UNSUPPORTED
   Even "account-bound" Cloud API keys (prefix `AQ.`) are rejected; they're an
   onboarding bridge, not a long-term auth method. See:
       GOOGLE_AUTH_AND_PIPELINE_NOTES_2026-05-14.md  (repo root)
   This script now uses Application Default Credentials (ADC), which is also
   what works in Colab (Colab seeds ADC for you automatically).

PREREQUISITES
   1. uv pip install google-genai
   2. gcloud auth application-default login
   3. set env:
        GOOGLE_CLOUD_PROJECT=storyception-prod   (or your project)
        GOOGLE_CLOUD_LOCATION=global              (3.x preview models live on `global`)
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from google import genai
from google.genai import types


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


ROOT = Path(__file__).resolve().parents[2]
load_env_file(ROOT / ".env")
load_env_file(ROOT / ".env.local")


def build_client() -> genai.Client:
    """Vertex AI + ADC. Matches the JS path in lib/gemini-client.ts when
    GOOGLE_GENAI_VERTEX_USE_GCP_PROJECT=1.
    """
    project = (
        os.environ.get("GOOGLE_CLOUD_PROJECT")
        or os.environ.get("GOOGLE_GENAI_VERTEX_PROJECT")
        or ""
    ).strip()
    location = (
        os.environ.get("GOOGLE_CLOUD_LOCATION")
        or os.environ.get("GOOGLE_GENAI_VERTEX_LOCATION")
        or "global"
    ).strip()

    if not project:
        sys.exit(
            "Missing GOOGLE_CLOUD_PROJECT. Set it in .env.local or your shell. "
            "Also run `gcloud auth application-default login` once per machine."
        )

    return genai.Client(vertexai=True, project=project, location=location)


def generate() -> None:
    client = build_client()

    model = "gemini-3-pro-image-preview"

    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(
                    text="Generate a cinematic wide shot of a glowing futuristic city at sunset."
                )
            ],
        )
    ]

    generate_content_config = types.GenerateContentConfig(
        temperature=1,
        top_p=0.95,
        max_output_tokens=32768,
        response_modalities=["TEXT", "IMAGE"],
        safety_settings=[
            types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"),
            types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF"),
        ],
        image_config=types.ImageConfig(
            aspect_ratio="16:9",
            image_size="2K",
            output_mime_type="image/png",
        ),
    )

    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        if not chunk.candidates:
            continue
        for part in chunk.candidates[0].content.parts:
            if part.text:
                print(part.text, end="")
            if part.inline_data:
                with open("output_image.png", "wb") as f:
                    f.write(part.inline_data.data)
                print("\n[Image generated and saved to output_image.png]")


if __name__ == "__main__":
    generate()
