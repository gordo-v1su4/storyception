#!/usr/bin/env python3
"""
Full Session Test: Creates a complete story session with keyframes

Tests: Session → Beat → fal.ai → Nextcloud → NocoDB
"""

import os
import requests
import base64
from datetime import datetime
from requests.auth import HTTPBasicAuth

# ============ CONFIGURATION ============

# fal.ai
FAL_KEY = os.getenv("FAL_KEY")

# NocoDB  
NOCODB_BASE_URL = os.getenv("NOCODB_BASE_URL", "https://nocodb.v1su4.com")
NOCODB_API_TOKEN = os.getenv("NOCODB_API_TOKEN")

# Table IDs
TABLE_SESSIONS = os.getenv("NOCODB_TABLE_SESSIONS", "m1icipflxgrce6y")
TABLE_BEATS = os.getenv("NOCODB_TABLE_BEATS", "ms4mo8ekjtrqz48")
TABLE_BRANCHES = os.getenv("NOCODB_TABLE_BRANCHES", "mypczrrly1k8gsi")
TABLE_KEYFRAMES = os.getenv("NOCODB_TABLE_KEYFRAMES", "m301ac822mwqpy0")

# Nextcloud
NEXTCLOUD_URL = os.getenv("NEXTCLOUD_BASE_URL", "https://nextcloud.v1su4.com")
NEXTCLOUD_USER = os.getenv("NEXTCLOUD_USERNAME", "admin")
NEXTCLOUD_APP_PASSWORD = os.getenv("NEXTCLOUD_APP_PASSWORD")

# Validate required env vars
if not all([FAL_KEY, NOCODB_API_TOKEN, NEXTCLOUD_APP_PASSWORD]):
    print("Error: Missing required environment variables:")
    print("  - FAL_KEY")
    print("  - NOCODB_API_TOKEN")
    print("  - NEXTCLOUD_APP_PASSWORD")
    exit(1)
WEBDAV_URL = f"{NEXTCLOUD_URL}/remote.php/dav/files/{NEXTCLOUD_USER}"
OCS_SHARE_URL = f"{NEXTCLOUD_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares"

nc_auth = HTTPBasicAuth(NEXTCLOUD_USER, NEXTCLOUD_APP_PASSWORD)

# ============ NOCODB FUNCTIONS ============

def nocodb_create(table_id: str, data: dict):
    """Create a record in NocoDB"""
    response = requests.post(
        f"{NOCODB_BASE_URL}/api/v2/tables/{table_id}/records",
        headers={"xc-token": NOCODB_API_TOKEN, "Content-Type": "application/json"},
        json=data
    )
    if response.status_code in [200, 201]:
        return response.json()
    print(f"   NocoDB Error: {response.status_code} - {response.text[:200]}")
    return None

# ============ NEXTCLOUD FUNCTIONS ============

def nextcloud_upload(image_data: str, remote_path: str):
    """Upload base64 image to Nextcloud"""
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

def nextcloud_share(path: str):
    """Create public share link"""
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

# ============ FAL.AI FUNCTION ============

def generate_keyframe(prompt: str, reference_image: str):
    """Generate keyframe with fal.ai Nano Banana"""
    response = requests.post(
        "https://fal.run/fal-ai/nano-banana-pro/edit",
        headers={"Authorization": f"Key {FAL_KEY}", "Content-Type": "application/json"},
        json={
            "prompt": prompt,
            "image_urls": [reference_image],
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

# ============ MAIN TEST ============

def main():
    print("=" * 70)
    print("STORYCEPTION - FULL SESSION TEST")
    print("=" * 70)
    
    # Generate unique IDs
    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    session_id = f"session-{timestamp}"
    
    print(f"\nSession ID: {session_id}")
    
    # ============ STEP 1: Create Session ============
    print("\n" + "-" * 50)
    print("STEP 1: Creating Session in NocoDB...")
    
    session_data = {
        "Session ID": session_id,
        "User ID": "test-user",
        "Archetype": "Save the Cat",
        "Outcome": "Hero Triumphant",
        "Status": "active",
        "Current Beat": 1,
        "Total Beats": 15,
        "Created At": datetime.now().isoformat(),
        "Updated At": datetime.now().isoformat()
    }
    
    session_result = nocodb_create(TABLE_SESSIONS, session_data)
    if session_result:
        print(f"   [OK] Session created: {session_id}")
    else:
        print("   [FAIL] Could not create session")
        return
    
    # ============ STEP 2: Create Beat ============
    print("\n" + "-" * 50)
    print("STEP 2: Creating Beat in NocoDB...")
    
    beat_id = f"{session_id}-beat-1"
    beat_data = {
        "Beat ID": beat_id,
        "Session ID": session_id,
        "Beat Index": 1,
        "Beat Label": "Opening Image",
        "Description": "A visual that represents the starting point",
        "Duration": "1%",
        "Percent of Total": 1,
        "Status": "generating",
        "Created At": datetime.now().isoformat()
    }
    
    beat_result = nocodb_create(TABLE_BEATS, beat_data)
    if beat_result:
        print(f"   [OK] Beat created: {beat_id}")
    else:
        print("   [FAIL] Could not create beat")
        return
    
    # ============ STEP 3: Generate Keyframe with fal.ai ============
    print("\n" + "-" * 50)
    print("STEP 3: Generating keyframe with fal.ai...")
    
    # Use Google's example image as reference
    reference_image = "https://storage.googleapis.com/falserverless/example_inputs/nano-banana-edit-input.png"
    prompt = "cinematic opening shot, dramatic sunrise, silhouette of protagonist"
    
    print(f"   Prompt: {prompt}")
    print(f"   Reference: {reference_image}")
    print("   Generating... (this takes ~30-60 seconds)")
    
    image_data = generate_keyframe(prompt, reference_image)
    if image_data and image_data.startswith("data:image"):
        print(f"   [OK] Generated image ({len(image_data)} chars)")
    else:
        print("   [FAIL] Could not generate image")
        return
    
    # ============ STEP 4: Upload to Nextcloud ============
    print("\n" + "-" * 50)
    print("STEP 4: Uploading to Nextcloud...")
    
    remote_path = f"storyception/{session_id}/{beat_id}/keyframe-1.png"
    
    if nextcloud_upload(image_data, remote_path):
        print(f"   [OK] Uploaded to: {remote_path}")
    else:
        print("   [FAIL] Upload failed")
        return
    
    # ============ STEP 5: Create Public Share Link ============
    print("\n" + "-" * 50)
    print("STEP 5: Creating public share link...")
    
    public_url = nextcloud_share(remote_path)
    if public_url:
        print(f"   [OK] Public URL: {public_url}")
    else:
        print("   [FAIL] Could not create share link")
        return
    
    # ============ STEP 6: Save Keyframe to NocoDB ============
    print("\n" + "-" * 50)
    print("STEP 6: Saving keyframe to NocoDB...")
    
    keyframe_id = f"{beat_id}-kf-1"
    keyframe_data = {
        "Keyframe ID": keyframe_id,
        "Session ID": session_id,
        "Beat ID": beat_id,
        "Frame Index (1-9)": 1,
        "Grid Row": 1,
        "Grid Col": 1,
        "Prompt": prompt,
        "Image URL": public_url,
        "Status": "ready",
        "Created At": datetime.now().isoformat()
    }
    
    keyframe_result = nocodb_create(TABLE_KEYFRAMES, keyframe_data)
    if keyframe_result:
        print(f"   [OK] Keyframe saved: {keyframe_id}")
    else:
        print("   [FAIL] Could not save keyframe")
        return
    
    # ============ SUMMARY ============
    print("\n" + "=" * 70)
    print("SUCCESS! Full session created:")
    print("=" * 70)
    print(f"""
    Session:   {session_id}
    Archetype: Save the Cat
    Beat:      {beat_id} (Opening Image)
    Keyframe:  {keyframe_id}
    
    Public Image URL:
    {public_url}
    
    Check NocoDB:
    https://nocodb.v1su4.com
    
    Check Nextcloud:
    https://nextcloud.v1su4.com/apps/files/?dir=/storyception/{session_id}
    """)

if __name__ == "__main__":
    main()
