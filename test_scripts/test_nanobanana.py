#!/usr/bin/env python3
"""
Test script for Nano Banana Pro API
Generates a 3x3 grid of 9 cinematic keyframes from a reference image
"""

import os
import base64
import json
import requests
from pathlib import Path

# Try to load from .env file if it exists
def load_env_file():
    """Load environment variables from .env file"""
    env_file = Path(".env")
    if env_file.exists():
        with open(env_file, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ[key.strip()] = value.strip().strip('"').strip("'")

load_env_file()

# Configuration
API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("VITE_GEMINI_API_KEY")
MODEL = "gemini-3-pro-image-preview"
ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"

# Image path
IMAGE_PATH = Path("cfd0fd43-bc61-4494-9b26-effb2363e0c4 (1) (Medium).png")

# Tailored prompt for 9-keyframe grid
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
    """Encode image to base64"""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")

def get_mime_type(image_path):
    """Get MIME type from file extension"""
    ext = image_path.suffix.lower()
    mime_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp"
    }
    return mime_types.get(ext, "image/png")

def main():
    if not API_KEY:
        print("ERROR: GEMINI_API_KEY or VITE_GEMINI_API_KEY environment variable not set")
        print("   Set it with: export GEMINI_API_KEY=your_key_here")
        print("   Or on Windows: $env:GEMINI_API_KEY='your_key_here'")
        return
    
    if not IMAGE_PATH.exists():
        print(f"ERROR: Image not found: {IMAGE_PATH}")
        return
    
    print(f"Loading image: {IMAGE_PATH}")
    image_base64 = encode_image(IMAGE_PATH)
    mime_type = get_mime_type(IMAGE_PATH)
    
    print("Preparing API request...")
    
    # Prepare the request payload
    payload = {
        "contents": [{
            "parts": [
                {
                    "inlineData": {
                        "mimeType": mime_type,
                        "data": image_base64
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
                "imageSize": "2K"  # Use 2K for good quality grid
            }
        }
    }
    
    headers = {
        "x-goog-api-key": API_KEY,
        "Content-Type": "application/json"
    }
    
    print(f"Calling {MODEL} API...")
    print("   This may take 30-60 seconds...")
    
    try:
        response = requests.post(ENDPOINT, headers=headers, json=payload, timeout=120)
        response.raise_for_status()
        
        result = response.json()
        
        # Check for errors
        if "error" in result:
            print(f"API Error: {result['error']}")
            return
        
        # Extract image from response
        candidates = result.get("candidates", [])
        if not candidates:
            print("No candidates in response")
            print(f"Response: {json.dumps(result, indent=2)}")
            return
        
        parts = candidates[0].get("content", {}).get("parts", [])
        
        # Save text response if present
        text_parts = [p.get("text", "") for p in parts if "text" in p]
        if text_parts:
            text_output = "\n".join(text_parts)
            output_text_file = Path("nanobanana_output.txt")
            with open(output_text_file, "w", encoding="utf-8") as f:
                f.write(text_output)
            print(f"SUCCESS: Text output saved to: {output_text_file}")
            print("\n--- Text Response Preview ---")
            print(text_output[:500] + "..." if len(text_output) > 500 else text_output)
        
        # Save image(s) from response
        image_parts = [p.get("inlineData", {}) for p in parts if "inlineData" in p]
        if image_parts:
            for idx, img_data in enumerate(image_parts):
                image_bytes = base64.b64decode(img_data.get("data", ""))
                output_image_file = Path(f"nanobanana_grid_{idx+1}.png")
                with open(output_image_file, "wb") as f:
                    f.write(image_bytes)
                print(f"SUCCESS: Grid image saved to: {output_image_file}")
        else:
            print("WARNING: No image found in response")
            print(f"Response structure: {json.dumps(result, indent=2)[:1000]}")
        
        print("\nAPI call completed successfully!")
        
    except requests.exceptions.Timeout:
        print("Request timed out (exceeded 120 seconds)")
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
