#!/usr/bin/env python3
"""Set Garage S3 bucket to public read"""

import boto3
import json
from botocore.config import Config

# Garage S3 config - load from environment
import os
GARAGE_ENDPOINT = os.getenv("GARAGE_ENDPOINT", "https://s3-garage.v1su4.com")
GARAGE_BUCKET = os.getenv("GARAGE_BUCKET", "nocodb")
GARAGE_ACCESS_KEY = os.getenv("GARAGE_ACCESS_KEY")
GARAGE_SECRET_KEY = os.getenv("GARAGE_SECRET_KEY")

if not GARAGE_ACCESS_KEY or not GARAGE_SECRET_KEY:
    print("Error: GARAGE_ACCESS_KEY and GARAGE_SECRET_KEY must be set in environment")
    exit(1)

# Public read policy
policy = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicRead",
            "Effect": "Allow",
            "Principal": "*",
            "Action": ["s3:GetObject"],
            "Resource": [f"arn:aws:s3:::{GARAGE_BUCKET}/*"]
        }
    ]
}

print(f"Setting public read policy on bucket: {GARAGE_BUCKET}")

s3 = boto3.client(
    's3',
    endpoint_url=GARAGE_ENDPOINT,
    aws_access_key_id=GARAGE_ACCESS_KEY,
    aws_secret_access_key=GARAGE_SECRET_KEY,
    config=Config(signature_version='s3v4'),
    region_name='garage'
)

try:
    s3.put_bucket_policy(
        Bucket=GARAGE_BUCKET,
        Policy=json.dumps(policy)
    )
    print("SUCCESS! Bucket is now public read.")
except Exception as e:
    print(f"Error: {e}")
    print("\nAlternative: SSH into your server and run:")
    print(f"  garage bucket allow --read --key '*' {GARAGE_BUCKET}")
