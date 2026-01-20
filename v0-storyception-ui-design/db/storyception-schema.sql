-- =============================================
-- STORYCEPTION DATABASE SCHEMA
-- Run this in NocoDB or import via SQL
-- =============================================

-- Table 1: Sessions (User story sessions)
CREATE TABLE IF NOT EXISTS storyception_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255),
    archetype VARCHAR(100) NOT NULL,
    outcome VARCHAR(100) NOT NULL,
    reference_image_url TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    current_beat INTEGER DEFAULT 1,
    total_beats INTEGER DEFAULT 15,
    story_data TEXT,  -- JSON blob
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table 2: Beats (Story beats per session)
CREATE TABLE IF NOT EXISTS storyception_beats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    beat_id VARCHAR(255) UNIQUE NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    beat_index INTEGER NOT NULL,
    beat_label VARCHAR(255) NOT NULL,
    beat_description TEXT,
    generated_idea TEXT,
    duration VARCHAR(20),
    percent_of_total DECIMAL(5,2),
    selected_branch_id VARCHAR(255),
    keyframes_json TEXT,  -- JSON array of keyframe URLs
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'ready', 'locked')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES storyception_sessions(session_id)
);

-- Table 3: Branches (A/B/C branch options)
CREATE TABLE IF NOT EXISTS storyception_branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id VARCHAR(255) UNIQUE NOT NULL,
    beat_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    branch_index INTEGER NOT NULL,  -- 0=A, 1=B, 2=C
    branch_type VARCHAR(50),  -- confrontation, discovery, escape, etc.
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration VARCHAR(20),
    keyframes_json TEXT,  -- JSON array of keyframe URLs
    is_selected BOOLEAN DEFAULT FALSE,
    depth INTEGER DEFAULT 0,  -- Inception depth (0=main, 1+=nested)
    parent_branch_id VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (beat_id) REFERENCES storyception_beats(beat_id),
    FOREIGN KEY (session_id) REFERENCES storyception_sessions(session_id)
);

-- Table 4: Keyframes (Individual keyframe images)
CREATE TABLE IF NOT EXISTS storyception_keyframes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyframe_id VARCHAR(255) UNIQUE NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    beat_id VARCHAR(255) NOT NULL,
    branch_id VARCHAR(255),
    frame_index INTEGER NOT NULL CHECK (frame_index BETWEEN 1 AND 9),
    grid_row INTEGER NOT NULL CHECK (grid_row BETWEEN 0 AND 2),
    grid_col INTEGER NOT NULL CHECK (grid_col BETWEEN 0 AND 2),
    prompt TEXT,
    image_url TEXT,  -- Garage S3 URL
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'ready', 'error')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES storyception_sessions(session_id),
    FOREIGN KEY (beat_id) REFERENCES storyception_beats(beat_id),
    FOREIGN KEY (branch_id) REFERENCES storyception_branches(branch_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_status ON storyception_sessions(status);
CREATE INDEX IF NOT EXISTS idx_beats_session ON storyception_beats(session_id);
CREATE INDEX IF NOT EXISTS idx_branches_beat ON storyception_branches(beat_id);
CREATE INDEX IF NOT EXISTS idx_branches_session ON storyception_branches(session_id);
CREATE INDEX IF NOT EXISTS idx_keyframes_beat ON storyception_keyframes(beat_id);
CREATE INDEX IF NOT EXISTS idx_keyframes_branch ON storyception_keyframes(branch_id);
