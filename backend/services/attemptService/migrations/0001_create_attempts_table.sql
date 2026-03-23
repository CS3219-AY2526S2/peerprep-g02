CREATE TABLE IF NOT EXISTS attempts (
    id UUID PRIMARY KEY,
    clerk_user_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    language TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    result TEXT NOT NULL,
    duration DOUBLE PRECISION NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT attempts_difficulty_check CHECK (difficulty IN ('easy', 'medium', 'hard')),
    CONSTRAINT attempts_result_check CHECK (result IN ('success', 'fail')),
    CONSTRAINT attempts_duration_nonnegative_check CHECK (duration >= 0)
);

CREATE INDEX IF NOT EXISTS idx_attempts_clerk_user_id ON attempts(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_question_id ON attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_attempted_at ON attempts(attempted_at DESC);
