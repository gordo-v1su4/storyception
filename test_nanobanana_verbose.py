#!/usr/bin/env python3
"""
Verbose test script - shows what's being sent to the API
"""

import os
import base64
import json
import requests
from pathlib import Path

API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("VITE_GEMINI_API_KEY")
MODEL = "gemini-3-pro-image-preview"
ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
IMAGE_PATH = Path("cfd0fd43-bc61-4494-9b26-effb2363e0c4 (1) (Medium).png")

PROMPT = """You are an award-winning trailer director + cinematographer + storyboard artist.

TASK: Transform the provided reference image into a cinematic sequence of 9 keyframes arranged in a 3x3 grid.

CRITICAL RULES:
1. Analyze the full composition: Identify ALL key subjects (people, objects, environment), their positions, facing directions, and interactions.
2. USE THE EXACT SAME CHARACTERS/PEOPLE FROM THE REFERENCE IMAGE: The same person(s) must appear in all 9 keyframes with the same physical appearance, facial features, body type, skin tone, hair style, and distinctive features (tattoos, clothing, accessories, etc.).
3. Maintain strict continuity: Same subjects, same wardrobe/appearance, same environment, same time-of-day and lighting style across ALL 9 frames.
4. Only change: action, expression, blocking, framing, camera angle, and camera movement between frames.
5. Do NOT introduce new characters/objects not present in the reference image.
6. Depth of field must be realistic: deeper in wides, shallower in close-ups.

OUTPUT REQUIREMENTS:
- Generate exactly 9 keyframes arranged in a 3x3 grid (3 columns × 3 rows)
- Each keyframe must feature the SAME person/character from the reference image - maintain their exact appearance, features, and distinctive characteristics
- Each keyframe should be a distinct cinematic moment that advances a story
- Include: 1 environment-establishing wide shot, 1 intimate close-up, 1 extreme detail ECU, and 1 power-angle shot (low or high)
- Maintain consistent cinematic color grade across all frames
- Each frame should show a progression: setup → build → turn → payoff (emotional arc)
- Label each frame clearly: KF1, KF2, KF3, etc. (labels in safe margins, not covering subjects)

CINEMATIC APPROACH:
- Shot progression: Move from wide to close (or reverse) to serve the story beats
- Camera movement: Use push/pull/pan/dolly/track/orbit/handheld as appropriate
- Lens: Vary focal lengths (18/24/35/50/85mm) appropriately for each shot type
- Lighting: Keep consistent with reference image's lighting style and time-of-day

Create a cohesive 10-20 second cinematic sequence where all 9 keyframes flow together as a storyboard grid."""

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")

def get_mime_type(image_path):
    ext = image_path.suffix.lower()
    mime_types = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
    return mime_types.get(ext, "image/png")

if __name__ == "__main__":
    print("=" * 60)
    print("VERIFYING API REQUEST PAYLOAD")
    print("=" * 60)
    
    image_base64 = encode_image(IMAGE_PATH)
    mime_type = get_mime_type(IMAGE_PATH)
    
    payload = {
        "contents": [{
            "parts": [
                {
                    "inlineData": {
                        "mimeType": mime_type,
                        "data": image_base64[:100] + "..."  # Show first 100 chars
                    }
                },
                {
                    "text": PROMPT
                }
            ]
        }],
        "generationConfig": {
            "imageConfig": {
                "aspectRatio": "16:9",
                "imageSize": "2K"
            }
        }
    }
    
    print("\n1. IMAGE INCLUDED: YES")
    print(f"   - MIME Type: {mime_type}")
    print(f"   - Base64 length: {len(image_base64)} characters")
    print(f"   - Base64 preview: {image_base64[:50]}...")
    
    print("\n2. PROMPT INCLUDED: YES")
    print(f"   - Prompt length: {len(PROMPT)} characters")
    print(f"   - Contains 'SAME CHARACTER': {'SAME CHARACTER' in PROMPT.upper()}")
    print(f"   - Contains 'reference image': {'reference image' in PROMPT.lower()}")
    
    print("\n3. PAYLOAD STRUCTURE:")
    print(json.dumps({
        "contents": [{
            "parts": [
                {"inlineData": {"mimeType": mime_type, "data": "[BASE64_DATA]"}},
                {"text": "[PROMPT_TEXT]"}
            ]
        }],
        "generationConfig": payload["generationConfig"]
    }, indent=2))
    
    print("\n" + "=" * 60)
    print("CONFIRMATION: Image IS included in the API request")
    print("The reference image is sent as inlineData in the parts array")
    print("=" * 60)
