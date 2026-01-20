#!/usr/bin/env python3
"""
Setup NocoDB tables for Storyception
Run this once to create all required tables

Tables already created with IDs:
- Storyception Sessions: m1icipflxgrce6y
- Storyception Beats: ms4mo8ekjtrqz48
- Storyception Branches: mypczrrly1k8gsi
- Storyception Keyframes: m301ac822mwqpy0
"""

import os
import json
import requests
from pathlib import Path

# NocoDB Configuration
NOCODB_BASE_URL = "https://nocodb.v1su4.com"
NOCODB_BASE_ID = "nc211km4izy9q867"
NOCODB_API_TOKEN = os.getenv("NOCODB_API_TOKEN", "")

# API Endpoint
API_URL = f"{NOCODB_BASE_URL}/api/v2/meta/bases/{NOCODB_BASE_ID}/tables"

# Headers
HEADERS = {
    "xc-token": NOCODB_API_TOKEN,
    "Content-Type": "application/json"
}

# Table definitions
TABLES = [
    {
        "table_name": "storyception_sessions",
        "title": "Storyception Sessions",
        "columns": [
            {"column_name": "session_id", "title": "Session ID", "uidt": "SingleLineText", "pv": True},
            {"column_name": "user_id", "title": "User ID", "uidt": "SingleLineText"},
            {"column_name": "archetype", "title": "Archetype", "uidt": "SingleLineText"},
            {"column_name": "outcome", "title": "Outcome", "uidt": "SingleLineText"},
            {"column_name": "reference_image_url", "title": "Reference Image URL", "uidt": "URL"},
            {"column_name": "status", "title": "Status", "uidt": "SingleSelect", "dtxp": "'active','completed','abandoned'"},
            {"column_name": "current_beat", "title": "Current Beat", "uidt": "Number"},
            {"column_name": "total_beats", "title": "Total Beats", "uidt": "Number"},
            {"column_name": "story_data", "title": "Story Data (JSON)", "uidt": "LongText"},
            {"column_name": "created_at", "title": "Created At", "uidt": "DateTime"},
            {"column_name": "updated_at", "title": "Updated At", "uidt": "DateTime"}
        ]
    },
    {
        "table_name": "storyception_beats",
        "title": "Storyception Beats",
        "columns": [
            {"column_name": "beat_id", "title": "Beat ID", "uidt": "SingleLineText", "pv": True},
            {"column_name": "session_id", "title": "Session ID", "uidt": "SingleLineText"},
            {"column_name": "beat_index", "title": "Beat Index", "uidt": "Number"},
            {"column_name": "beat_label", "title": "Beat Label", "uidt": "SingleLineText"},
            {"column_name": "beat_description", "title": "Description", "uidt": "LongText"},
            {"column_name": "generated_idea", "title": "Generated Idea", "uidt": "LongText"},
            {"column_name": "duration", "title": "Duration", "uidt": "SingleLineText"},
            {"column_name": "percent_of_total", "title": "Percent of Total", "uidt": "Number"},
            {"column_name": "selected_branch_id", "title": "Selected Branch ID", "uidt": "SingleLineText"},
            {"column_name": "keyframes_json", "title": "Keyframes (JSON)", "uidt": "LongText"},
            {"column_name": "status", "title": "Status", "uidt": "SingleSelect", "dtxp": "'pending','generating','ready','locked'"},
            {"column_name": "created_at", "title": "Created At", "uidt": "DateTime"}
        ]
    },
    {
        "table_name": "storyception_branches",
        "title": "Storyception Branches",
        "columns": [
            {"column_name": "branch_id", "title": "Branch ID", "uidt": "SingleLineText", "pv": True},
            {"column_name": "beat_id", "title": "Beat ID", "uidt": "SingleLineText"},
            {"column_name": "session_id", "title": "Session ID", "uidt": "SingleLineText"},
            {"column_name": "branch_index", "title": "Branch Index", "uidt": "Number"},
            {"column_name": "branch_type", "title": "Branch Type", "uidt": "SingleLineText"},
            {"column_name": "title", "title": "Title", "uidt": "SingleLineText"},
            {"column_name": "description", "title": "Description", "uidt": "LongText"},
            {"column_name": "duration", "title": "Duration", "uidt": "SingleLineText"},
            {"column_name": "keyframes_json", "title": "Keyframes (JSON)", "uidt": "LongText"},
            {"column_name": "is_selected", "title": "Is Selected", "uidt": "Checkbox"},
            {"column_name": "depth", "title": "Inception Depth", "uidt": "Number"},
            {"column_name": "parent_branch_id", "title": "Parent Branch ID", "uidt": "SingleLineText"},
            {"column_name": "created_at", "title": "Created At", "uidt": "DateTime"}
        ]
    },
    {
        "table_name": "storyception_keyframes",
        "title": "Storyception Keyframes",
        "columns": [
            {"column_name": "keyframe_id", "title": "Keyframe ID", "uidt": "SingleLineText", "pv": True},
            {"column_name": "session_id", "title": "Session ID", "uidt": "SingleLineText"},
            {"column_name": "beat_id", "title": "Beat ID", "uidt": "SingleLineText"},
            {"column_name": "branch_id", "title": "Branch ID", "uidt": "SingleLineText"},
            {"column_name": "frame_index", "title": "Frame Index (1-9)", "uidt": "Number"},
            {"column_name": "grid_row", "title": "Grid Row", "uidt": "Number"},
            {"column_name": "grid_col", "title": "Grid Col", "uidt": "Number"},
            {"column_name": "prompt", "title": "Prompt", "uidt": "LongText"},
            {"column_name": "image_url", "title": "Image URL", "uidt": "URL"},
            {"column_name": "status", "title": "Status", "uidt": "SingleSelect", "dtxp": "'pending','generating','ready','error'"},
            {"column_name": "created_at", "title": "Created At", "uidt": "DateTime"}
        ]
    }
]


def create_table(table_def):
    """Create a single table in NocoDB"""
    print(f"Creating table: {table_def['title']}...")
    
    try:
        response = requests.post(
            API_URL,
            headers=HEADERS,
            json=table_def,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"  [OK] Created: {table_def['table_name']} (ID: {result.get('id', 'unknown')})")
            return result
        elif response.status_code == 400 and "already exists" in response.text.lower():
            print(f"  [SKIP] Table already exists: {table_def['table_name']}")
            return None
        else:
            print(f"  [ERROR] ({response.status_code}): {response.text[:500]}")
            return None
            
    except Exception as e:
        print(f"  [ERROR] Exception: {e}")
        return None


def main():
    print("=" * 60)
    print("STORYCEPTION - NocoDB Table Setup")
    print("=" * 60)
    print(f"Base URL: {NOCODB_BASE_URL}")
    print(f"Base ID: {NOCODB_BASE_ID}")
    print()
    
    created_tables = []
    
    for table_def in TABLES:
        result = create_table(table_def)
        if result:
            created_tables.append({
                "name": table_def["table_name"],
                "id": result.get("id")
            })
        print()
    
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    if created_tables:
        print(f"[OK] Created {len(created_tables)} tables:")
        for t in created_tables:
            print(f"   - {t['name']}: {t['id']}")
        
        print()
        print("Add these table IDs to your .env.local:")
        for t in created_tables:
            env_name = f"NOCODB_TABLE_{t['name'].upper().replace('STORYCEPTION_', '')}"
            print(f"   {env_name}={t['id']}")
    else:
        print("No new tables created (may already exist)")
    
    print()
    print("Done! You can now run the Storyception UI.")


if __name__ == "__main__":
    main()
