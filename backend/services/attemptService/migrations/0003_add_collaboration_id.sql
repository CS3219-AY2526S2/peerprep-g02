ALTER TABLE attempts ADD COLUMN IF NOT EXISTS collaboration_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_attempts_user_collaboration
    ON attempts(clerk_user_id, collaboration_id)
    WHERE collaboration_id IS NOT NULL;
