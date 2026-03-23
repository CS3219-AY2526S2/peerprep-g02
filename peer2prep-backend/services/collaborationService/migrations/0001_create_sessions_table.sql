-- Collaboration Sessions table
-- Stores completed/inactive session history for audit and analytics

CREATE TABLE IF NOT EXISTS collaboration_sessions (
    collaboration_id UUID PRIMARY KEY,
    match_id TEXT,
    user_a_id TEXT NOT NULL,
    user_b_id TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    language TEXT NOT NULL,
    topic TEXT NOT NULL,
    question_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    final_code TEXT,
    ended_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,

    CONSTRAINT difficulty_check CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    CONSTRAINT status_check CHECK (status IN ('active', 'inactive'))
);

-- Index for user history lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_a ON collaboration_sessions(user_a_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_b ON collaboration_sessions(user_b_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON collaboration_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON collaboration_sessions(created_at DESC);
