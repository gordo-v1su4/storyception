#!/usr/bin/env python3
"""
Generate 9 keyframes for a beat - full storyboard grid
"""

import requests
import base64
from requests.auth import HTTPBasicAuth

# Config - load from environment
import os
FAL_KEY = os.getenv("FAL_KEY")
NEXTCLOUD_URL = os.getenv("NEXTCLOUD_BASE_URL", "https://nextcloud.v1su4.com")
NEXTCLOUD_USER = os.getenv("NEXTCLOUD_USERNAME", "admin")
NEXTCLOUD_APP_PASSWORD = os.getenv("NEXTCLOUD_APP_PASSWORD")

if not FAL_KEY or not NEXTCLOUD_APP_PASSWORD:
    print("Error: FAL_KEY and NEXTCLOUD_APP_PASSWORD must be set in environment")
    exit(1)
WEBDAV_URL = f"{NEXTCLOUD_URL}/remote.php/dav/files/{NEXTCLOUD_USER}"
OCS_SHARE_URL = f"{NEXTCLOUD_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares"

nc_auth = HTTPBasicAuth(NEXTCLOUD_USER, NEXTCLOUD_APP_PASSWORD)

# Session info
SESSION_ID = "session-full-test-001"
BEAT_ID = "session-full-test-001-beat-1"

# 9 different shot prompts for Opening Image beat
PROMPTS = [
    "Wide establishing shot, golden sunrise over city skyline, cinematic",
    "Medium shot protagonist silhouette against window, morning light",
    "Close-up alarm clock showing 6:00 AM, shallow depth of field",
    "Over-shoulder shot protagonist looking at mirror, contemplative",
    "Wide shot empty apartment, minimalist modern interior",
    "Medium close-up hands reaching for coffee cup, steam rising",
    "Low angle shot looking up at tall buildings, dramatic sky",
    "Close-up eyes opening, catching morning light, emotional",
    "Wide aerial shot city streets beginning to wake, drone view"
]

# Reference image
REFERENCE_IMAGE = "https://storage.googleapis.com/falserverless/example_inputs/nano-banana-edit-input.png"

def generate_keyframe(prompt: str, index: int):
    """Generate single keyframe"""
    print(f"   [{index}/9] Generating: {prompt[:50]}...")
    
    response = requests.post(
        "https://fal.run/fal-ai/nano-banana-pro/edit",
        headers={"Authorization": f"Key {FAL_KEY}", "Content-Type": "application/json"},
        json={
            "prompt": f"cinematic style: {prompt}",
            "image_urls": [REFERENCE_IMAGE],
            "aspect_ratio": "16:9",
            "resolution": "1K",
            "num_images": 1,
            "output_format": "png",
            "sync_mode": True
        },
        timeout=120
    )
    
    if response.status_code == 200:
        data = response.json()
        images = data.get("images", [])
        if images:
            return images[0].get("url")
    return None

def upload_to_nextcloud(image_data: str, remote_path: str):
    """Upload to Nextcloud"""
    if image_data.startswith("data:"):
        image_data = image_data.split(",")[1]
    image_bytes = base64.b64decode(image_data)
    
    # Create folders
    parts = remote_path.split("/")
    for i in range(1, len(parts)):
        folder = "/".join(parts[:i])
        requests.request("MKCOL", f"{WEBDAV_URL}/{folder}/", auth=nc_auth)
    
    response = requests.put(
        f"{WEBDAV_URL}/{remote_path}",
        data=image_bytes,
        auth=nc_auth,
        headers={'Content-Type': 'image/png'}
    )
    return response.status_code in [200, 201, 204]

def create_share_link(path: str):
    """Create public share"""
    response = requests.post(
        OCS_SHARE_URL,
        auth=nc_auth,
        headers={'OCS-APIRequest': 'true', 'Content-Type': 'application/x-www-form-urlencoded'},
        data={'path': f"/{path}", 'shareType': 3, 'permissions': 1}
    )
    if response.status_code == 200:
        import xml.etree.ElementTree as ET
        root = ET.fromstring(response.text)
        url_elem = root.find('.//url')
        if url_elem is not None:
            return url_elem.text.replace('http://', 'https://') + '/download'
    return None

def main():
    print("=" * 70)
    print("GENERATING 9 KEYFRAMES FOR OPENING IMAGE BEAT")
    print("=" * 70)
    print(f"Session: {SESSION_ID}")
    print(f"Beat: {BEAT_ID}")
    print()
    
    keyframes = []
    
    for i, prompt in enumerate(PROMPTS, 1):
        row = (i - 1) // 3 + 1
        col = (i - 1) % 3 + 1
        
        # Generate
        print(f"\n[{i}/9] Row {row}, Col {col}")
        image_data = generate_keyframe(prompt, i)
        
        if not image_data:
            print(f"   FAILED to generate")
            continue
        
        print(f"   Generated ({len(image_data)} chars)")
        
        # Upload
        remote_path = f"storyception/{SESSION_ID}/{BEAT_ID}/keyframe-{i}.png"
        if upload_to_nextcloud(image_data, remote_path):
            print(f"   Uploaded to Nextcloud")
        else:
            print(f"   Upload FAILED")
            continue
        
        # Share
        public_url = create_share_link(remote_path)
        if public_url:
            print(f"   Share URL: {public_url}")
        else:
            print(f"   Share FAILED")
            continue
        
        keyframes.append({
            "index": i,
            "row": row,
            "col": col,
            "prompt": prompt,
            "url": public_url
        })
    
    # Output for NocoDB
    print("\n" + "=" * 70)
    print(f"SUCCESS! Generated {len(keyframes)}/9 keyframes")
    print("=" * 70)
    print("\nKeyframe data for NocoDB:")
    
    for kf in keyframes:
        print(f"""
Keyframe {kf['index']}:
  ID: {BEAT_ID}-kf-{kf['index']}
  Row: {kf['row']}, Col: {kf['col']}
  Prompt: {kf['prompt'][:50]}...
  URL: {kf['url']}""")
    
    # Save to file for MCP import
    import json
    with open("keyframes_data.json", "w") as f:
        json.dump(keyframes, f, indent=2)
    print(f"\nSaved to keyframes_data.json")

if __name__ == "__main__":
    main()
