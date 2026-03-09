CREATE TABLE IF NOT EXISTS users (
    clerk_user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar_url TEXT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    role TEXT NOT NULL DEFAULT 'user',
    preferred_language TEXT NULL,
    last_login_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended', 'deleted')),
    CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'))
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY,
    actor_user_id TEXT NOT NULL REFERENCES users(clerk_user_id),
    action TEXT NOT NULL,
    target_user_id TEXT NULL REFERENCES users(clerk_user_id),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT admin_audit_logs_action_check CHECK (
        action IN ('PROMOTE_USER', 'DEMOTE_USER', 'SUSPEND_USER', 'UNSUSPEND_USER')
    )
);
