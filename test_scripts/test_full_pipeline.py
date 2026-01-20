#!/usr/bin/env python3
"""
Full Pipeline Test: fal.ai → Nextcloud → NocoDB

Tests the complete image generation and storage workflow.
"""

import os
import requests
import base64
from datetime import datetime
from requests.auth import HTTPBasicAuth

# Environment variables
FAL_KEY = os.getenv("FAL_KEY")
NOCODB_API_TOKEN = os.getenv("NOCODB_API_TOKEN")

# Nextcloud config
NEXTCLOUD_URL = os.getenv("NEXTCLOUD_BASE_URL", "https://nextcloud.v1su4.com")
NEXTCLOUD_USER = os.getenv("NEXTCLOUD_USERNAME", "admin")
NEXTCLOUD_APP_PASSWORD = os.getenv("NEXTCLOUD_APP_PASSWORD")
WEBDAV_URL = f"{NEXTCLOUD_URL}/remote.php/dav/files/{NEXTCLOUD_USER}"
OCS_SHARE_URL = f"{NEXTCLOUD_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares"

# NocoDB config
NOCODB_BASE_URL = "https://nocodb.v1su4.com"
NOCODB_TABLE_KEYFRAMES = "m301ac822mwqpy0"

# Auth for Nextcloud
nc_auth = HTTPBasicAuth(NEXTCLOUD_USER, NEXTCLOUD_APP_PASSWORD)

def check_env():
    """Verify required environment variables are set"""
    if not FAL_KEY:
        print("Error: FAL_KEY not set")
        return False
    if not NOCODB_API_TOKEN:
        print("Error: NOCODB_API_TOKEN not set")
        return False
    if not NEXTCLOUD_APP_PASSWORD:
        print("Error: NEXTCLOUD_APP_PASSWORD not set")
        return False
    return True

def generate_image_with_fal():
    """Call fal.ai to generate an image"""
    print("\n1. Generating image with fal.ai...")
    
    payload = {
        "prompt": "cinematic portrait, dramatic lighting, film grain",
        "image_urls": ["https://storage.googleapis.com/falserverless/example_inputs/nano-banana-edit-input.png"],
        "aspect_ratio": "16:9",
        "resolution": "1K",
        "num_images": 1,
        "output_format": "png",
        "sync_mode": True
    }
    
    response = requests.post(
        "https://fal.run/fal-ai/nano-banana-pro/edit",
        headers={
            "Authorization": f"Key {FAL_KEY}",
            "Content-Type": "application/json"
        },
        json=payload,
        timeout=120
    )
    
    if response.status_code != 200:
        print(f"   Error: {response.status_code} - {response.text[:200]}")
        return None
    
    data = response.json()
    images = data.get("images", [])
    
    if not images:
        print("   Error: No images returned")
        return None
    
    # Image is returned as base64 data URL
    image_data = images[0].get("url", "")
    print(f"   SUCCESS! Got image data ({len(image_data)} chars)")
    
    return image_data

def upload_to_nextcloud(image_data: str, remote_path: str):
    """Upload image to Nextcloud via WebDAV"""
    print("\n2. Uploading to Nextcloud...")
    
    # Decode base64 if it's a data URL
    if image_data.startswith("data:image"):
        base64_data = image_data.split(",")[1]
        image_bytes = base64.b64decode(base64_data)
    else:
        image_bytes = image_data.encode() if isinstance(image_data, str) else image_data
    
    print(f"   Image size: {len(image_bytes)} bytes")
    
    # Create folders
    parts = remote_path.split("/")
    for i in range(1, len(parts)):
        folder = "/".join(parts[:i])
        requests.request("MKCOL", f"{WEBDAV_URL}/{folder}/", auth=nc_auth)
    
    # Upload file
    response = requests.put(
        f"{WEBDAV_URL}/{remote_path}",
        data=image_bytes,
        auth=nc_auth,
        headers={'Content-Type': 'image/png'}
    )
    
    if response.status_code not in [200, 201, 204]:
        print(f"   Upload failed: {response.status_code}")
        return None
    
    print(f"   SUCCESS! Uploaded to: {remote_path}")
    return remote_path

def create_share_link(path: str):
    """Create public share link for file"""
    print("\n3. Creating public share link...")
    
    response = requests.post(
        OCS_SHARE_URL,
        auth=nc_auth,
        headers={
            'OCS-APIRequest': 'true',
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data={
            'path': f"/{path}",
            'shareType': 3,
            'permissions': 1
        }
    )
    
    if response.status_code == 200:
        import xml.etree.ElementTree as ET
        root = ET.fromstring(response.text)
        url_elem = root.find('.//url')
        if url_elem is not None:
            share_url = url_elem.text.replace('http://', 'https://')
            print(f"   SUCCESS! Share URL: {share_url}")
            return f"{share_url}/download"
    
    print(f"   Failed: {response.status_code}")
    return None

def save_to_nocodb(keyframe_data: dict):
    """Create a keyframe record in NocoDB"""
    print("\n3. Saving to NocoDB...")
    
    response = requests.post(
        f"{NOCODB_BASE_URL}/api/v2/tables/{NOCODB_TABLE_KEYFRAMES}/records",
        headers={
            "Content-Type": "application/json",
            "xc-token": NOCODB_API_TOKEN
        },
        json=keyframe_data
    )
    
    if response.status_code not in [200, 201]:
        print(f"   Error: {response.status_code} - {response.text[:200]}")
        return None
    
    result = response.json()
    print(f"   SUCCESS! Created record ID: {result.get('Id', 'N/A')}")
    
    return result

def main():
    """Run the full pipeline test"""
    print("=" * 60)
    print("STORYCEPTION FULL PIPELINE TEST")
    print("fal.ai -> Nextcloud -> NocoDB")
    print("=" * 60)
    
    if not check_env():
        return
    
    # Generate unique IDs for this test
    session_id = f"test-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    beat_id = f"{session_id}-beat-1"
    keyframe_id = f"{beat_id}-kf-1"
    
    # Step 1: Generate image
    image_data = generate_image_with_fal()
    if not image_data:
        return
    
    # Step 2: Upload to Nextcloud
    remote_path = f"storyception/{session_id}/beat-1/keyframe-1.png"
    uploaded_path = upload_to_nextcloud(image_data, remote_path)
    if not uploaded_path:
        return
    
    # Step 3: Create public share link
    public_url = create_share_link(uploaded_path)
    
    # Step 4: Save to NocoDB
    keyframe_record = {
        "Keyframe ID": keyframe_id,
        "Session ID": session_id,
        "Beat ID": beat_id,
        "Branch ID": None,
        "Frame Index (1-9)": 1,
        "Grid Row": 1,
        "Grid Col": 1,
        "Prompt": "cinematic portrait, dramatic lighting, film grain",
        "Image URL": public_url,
        "Status": "ready",
        "Created At": datetime.now().isoformat()
    }
    
    print("\n4. Saving to NocoDB...")
    result = save_to_nocodb(keyframe_record)
    
    # Summary
    print("\n" + "=" * 60)
    print("PIPELINE TEST COMPLETE")
    print("=" * 60)
    print(f"Session ID: {session_id}")
    print(f"Keyframe ID: {keyframe_id}")
    print(f"Nextcloud Path: {uploaded_path}")
    print(f"Public URL: {public_url}")
    if result:
        print(f"NocoDB Record ID: {result.get('Id', 'N/A')}")
        print("\nCheck NocoDB at: https://nocodb.v1su4.com")
        print(f"View image at: {public_url}")

if __name__ == "__main__":
    main()
