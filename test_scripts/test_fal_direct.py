#!/usr/bin/env python3
"""Direct test of fal.ai Nano Banana Pro API"""

import requests
import json

import os
FAL_KEY = os.getenv("FAL_KEY")
if not FAL_KEY:
    print("Error: FAL_KEY not set. Run: $env:FAL_KEY = 'your-key'")
    exit(1)

payload = {
    "prompt": "cinematic portrait, dramatic lighting",
    "image_urls": ["https://storage.googleapis.com/falserverless/example_inputs/nano-banana-edit-input.png"],
    "aspect_ratio": "16:9",
    "resolution": "1K",
    "num_images": 1,
    "output_format": "png",
    "sync_mode": True
}

print("Testing fal.ai Nano Banana Pro...")
print("Endpoint: https://fal.run/fal-ai/nano-banana-pro/edit")
print(f"Payload: {json.dumps(payload, indent=2)}")
print("\nSending request (this may take 30-60 seconds)...")

response = requests.post(
    "https://fal.run/fal-ai/nano-banana-pro/edit",
    headers={
        "Authorization": f"Key {FAL_KEY}",
        "Content-Type": "application/json"
    },
    json=payload,
    timeout=120
)

print(f"\nStatus: {response.status_code}")
print(f"Response: {response.text[:1000]}")

if response.status_code == 200:
    data = response.json()
    if "images" in data:
        print(f"\nSUCCESS! Generated {len(data['images'])} image(s)")
        for img in data["images"]:
            print(f"  URL: {img.get('url', 'N/A')}")
