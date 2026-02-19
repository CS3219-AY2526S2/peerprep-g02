import { Pool, QueryResult, QueryResultRow } from "pg";

import { AppConstants } from "../constants.js";
import { logger } from "./logger.js";

const pool = new Pool({
    connectionString: AppConstants.DATABASE_URI,
});

pool.on("error", (error) => {
    logger.error({ err: error }, "Unexpected PostgreSQL pool error");
});

export async function initializePostgres(): Promise<void> {
    await pool.query("SELECT 1");

    await pool.query(`
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
        )
    `);

    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL");
    await pool.query(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'",
    );
    await pool.query(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'",
    );
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language TEXT NULL");
    await pool.query("ALTER TABLE users DROP COLUMN IF EXISTS email");
    await pool.query("ALTER TABLE users DROP COLUMN IF EXISTS reset_password_token_hash");
    await pool.query("ALTER TABLE users DROP COLUMN IF EXISTS reset_password_expires_at");

    await pool.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'users_status_check'
            ) THEN
                ALTER TABLE users
                ADD CONSTRAINT users_status_check
                CHECK (status IN ('active', 'suspended', 'deleted'));
            END IF;
        END $$;
    `);

    await pool.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'users_role_check'
            ) THEN
                ALTER TABLE users
                ADD CONSTRAINT users_role_check
                CHECK (role IN ('user', 'admin'));
            END IF;
        END $$;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_audit_logs (
            id UUID PRIMARY KEY,
            actor_user_id TEXT NOT NULL REFERENCES users(clerk_user_id),
            action TEXT NOT NULL,
            target_user_id TEXT NULL REFERENCES users(clerk_user_id),
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query("ALTER TABLE admin_audit_logs ALTER COLUMN target_user_id DROP NOT NULL");
    await pool.query("ALTER TABLE admin_audit_logs ALTER COLUMN metadata SET DEFAULT '{}'::jsonb");
    await pool.query("UPDATE admin_audit_logs SET metadata = '{}'::jsonb WHERE metadata IS NULL");
    await pool.query("ALTER TABLE admin_audit_logs ALTER COLUMN metadata SET NOT NULL");

    // Restrict actions to the supported admin operation set.
    await pool.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'admin_audit_logs_action_check'
            ) THEN
                ALTER TABLE admin_audit_logs
                ADD CONSTRAINT admin_audit_logs_action_check
                CHECK (
                    action IN (
                        'PROMOTE_USER',
                        'DEMOTE_USER',
                        'SUSPEND_USER',
                        'UNSUSPEND_USER'
                    )
                )
                NOT VALID;
            END IF;
        END $$;
    `);

    await pool.query(
        "CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_user_id ON admin_audit_logs (actor_user_id)",
    );
    await pool.query(
        "CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_user_id ON admin_audit_logs (target_user_id)",
    );
    await pool.query(
        "CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs (action)",
    );
    await pool.query(
        "CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs (created_at)",
    );
}

export async function query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
): Promise<QueryResult<T>> {
    return pool.query<T>(text, params);
}

export async function closePostgres(): Promise<void> {
    await pool.end();
}
