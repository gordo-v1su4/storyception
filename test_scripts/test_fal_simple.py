#!/usr/bin/env python3
"""Simple fal.ai test"""

import requests
import os

FAL_KEY = os.getenv("FAL_KEY")
if not FAL_KEY:
    print("Error: FAL_KEY not set")
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
print(f"Using image: {payload['image_urls'][0]}")

response = requests.post(
    "https://fal.run/fal-ai/nano-banana-pro/edit",
    headers={
        "Authorization": f"Key {FAL_KEY}",
        "Content-Type": "application/json"
    },
    json=payload,
    timeout=120
)

print(f"Status: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    images = data.get("images", [])
    print(f"SUCCESS! Generated {len(images)} image(s)")
    for i, img in enumerate(images):
        url = img.get("url", "N/A")
        print(f"  Image {i+1}: {url[:80]}...")
else:
    print(f"Error: {response.text[:300]}")
