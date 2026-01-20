#!/usr/bin/env python3
"""Upload image to Garage S3"""

import boto3
from botocore.config import Config
from pathlib import Path

# Garage S3 config - load from environment
import os
GARAGE_ENDPOINT = os.getenv("GARAGE_ENDPOINT", "https://s3-garage.v1su4.com")
GARAGE_BUCKET = os.getenv("GARAGE_BUCKET", "nocodb")
GARAGE_ACCESS_KEY = os.getenv("GARAGE_ACCESS_KEY")
GARAGE_SECRET_KEY = os.getenv("GARAGE_SECRET_KEY")

if not GARAGE_ACCESS_KEY or not GARAGE_SECRET_KEY:
    print("Error: GARAGE_ACCESS_KEY and GARAGE_SECRET_KEY must be set in environment")
    exit(1)

# Image to upload
IMAGE_PATH = Path("cfd0fd43-bc61-4494-9b26-effb2363e0c4 (1) (Medium).png")
S3_KEY = "storyception/test/reference-image.png"

print(f"Uploading {IMAGE_PATH} to Garage S3...")

# Create S3 client
s3 = boto3.client(
    's3',
    endpoint_url=GARAGE_ENDPOINT,
    aws_access_key_id=GARAGE_ACCESS_KEY,
    aws_secret_access_key=GARAGE_SECRET_KEY,
    config=Config(signature_version='s3v4'),
    region_name='garage'
)

# Upload
with open(IMAGE_PATH, 'rb') as f:
    s3.put_object(
        Bucket=GARAGE_BUCKET,
        Key=S3_KEY,
        Body=f,
        ContentType='image/png',
        ACL='public-read'
    )

print(f"SUCCESS!")
print(f"URL: {GARAGE_ENDPOINT}/{GARAGE_BUCKET}/{S3_KEY}")
