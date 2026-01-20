#!/usr/bin/env python3
"""
Test Nextcloud WebDAV upload and public share link creation
"""

import os
import requests
import base64
from requests.auth import HTTPBasicAuth

# Nextcloud config - load from environment
NEXTCLOUD_URL = os.getenv("NEXTCLOUD_BASE_URL", "https://nextcloud.v1su4.com")
NEXTCLOUD_USER = os.getenv("NEXTCLOUD_USERNAME", "admin")
NEXTCLOUD_APP_PASSWORD = os.getenv("NEXTCLOUD_APP_PASSWORD")

if not NEXTCLOUD_APP_PASSWORD:
    print("Error: NEXTCLOUD_APP_PASSWORD must be set in environment")
    exit(1)

# WebDAV and OCS endpoints
WEBDAV_URL = f"{NEXTCLOUD_URL}/remote.php/dav/files/{NEXTCLOUD_USER}"
OCS_SHARE_URL = f"{NEXTCLOUD_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares"

auth = HTTPBasicAuth(NEXTCLOUD_USER, NEXTCLOUD_APP_PASSWORD)

def upload_image(local_path: str, remote_path: str) -> bool:
    """Upload a file to Nextcloud via WebDAV"""
    url = f"{WEBDAV_URL}/{remote_path}"
    
    with open(local_path, 'rb') as f:
        response = requests.put(url, data=f, auth=auth)
    
    print(f"Upload status: {response.status_code}")
    return response.status_code in [200, 201, 204]

def upload_base64(base64_data: str, remote_path: str) -> bool:
    """Upload base64 image data to Nextcloud"""
    url = f"{WEBDAV_URL}/{remote_path}"
    
    # Handle data URL format
    if base64_data.startswith('data:'):
        base64_data = base64_data.split(',')[1]
    
    image_bytes = base64.b64decode(base64_data)
    
    response = requests.put(url, data=image_bytes, auth=auth, 
                           headers={'Content-Type': 'image/png'})
    
    print(f"Upload status: {response.status_code}")
    return response.status_code in [200, 201, 204]

def create_public_share(path: str) -> str:
    """Create a public share link for a file"""
    response = requests.post(
        OCS_SHARE_URL,
        auth=auth,
        headers={
            'OCS-APIRequest': 'true',
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data={
            'path': path,
            'shareType': 3,  # 3 = public link
            'permissions': 1  # 1 = read only
        }
    )
    
    print(f"Share status: {response.status_code}")
    
    if response.status_code == 200:
        # Parse XML response to get the share URL
        import xml.etree.ElementTree as ET
        root = ET.fromstring(response.text)
        url_elem = root.find('.//url')
        if url_elem is not None:
            return url_elem.text
    
    return None

def get_direct_download_url(share_url: str) -> str:
    """Convert share URL to direct download URL"""
    # Nextcloud share URLs like: https://nextcloud.v1su4.com/s/ABC123
    # Direct download: https://nextcloud.v1su4.com/s/ABC123/download
    return f"{share_url}/download"

def main():
    print("=" * 60)
    print("NEXTCLOUD UPLOAD TEST")
    print("=" * 60)
    
    # Test with local image
    test_image = "cfd0fd43-bc61-4494-9b26-effb2363e0c4 (1) (Medium).png"
    remote_path = "storyception/test-image.png"
    
    if os.path.exists(test_image):
        print(f"\n1. Uploading {test_image}...")
        if upload_image(test_image, remote_path):
            print("   SUCCESS!")
            
            print("\n2. Creating public share link...")
            share_url = create_public_share(f"/{remote_path}")
            
            if share_url:
                print(f"   Share URL: {share_url}")
                print(f"   Direct Download: {get_direct_download_url(share_url)}")
            else:
                print("   Failed to create share link")
        else:
            print("   Upload failed!")
    else:
        print(f"Test image not found: {test_image}")
        print("Creating a test file instead...")
        
        # Create a simple test
        test_content = b"Test file for Nextcloud"
        response = requests.put(
            f"{WEBDAV_URL}/storyception/test.txt",
            data=test_content,
            auth=auth
        )
        print(f"Test file upload: {response.status_code}")

if __name__ == "__main__":
    main()
