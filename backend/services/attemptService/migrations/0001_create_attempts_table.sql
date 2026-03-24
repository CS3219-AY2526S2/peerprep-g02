CREATE TABLE IF NOT EXISTS attempts (
    id UUID PRIMARY KEY,
    clerk_user_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    language TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    duration DOUBLE PRECISION NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT attempts_difficulty_check CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    CONSTRAINT attempts_duration_nonnegative_check CHECK (duration >= 0)
);

CREATE INDEX IF NOT EXISTS idx_attempts_clerk_user_id ON attempts(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_question_id ON attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_attempted_at ON attempts(attempted_at DESC);
