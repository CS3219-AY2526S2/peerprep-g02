import { query } from "../utils/postgres.js";

export type UserStatus = "active" | "suspended" | "deleted";
export type UserRole = "user" | "admin" | "super_user";
export type AdminAuditAction =
    | "PROMOTE_USER"
    | "DEMOTE_USER"
    | "SUSPEND_USER"
    | "UNSUSPEND_USER";

type UserRow = {
    clerk_user_id: string;
    name: string;
    avatar_url: string | null;
    status: UserStatus;
    role: UserRole;
    score: number;
    preferred_language: string | null;
    last_login_at: Date | null;
    created_at: Date;
    updated_at: Date;
};

export type UserRecord = {
    clerkUserId: string;
    name: string;
    avatarUrl: string | null;
    status: UserStatus;
    role: UserRole;
    score: number;
    preferredLanguage: string | null;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

function mapUserRow(row: UserRow): UserRecord {
    return {
        clerkUserId: row.clerk_user_id,
        name: row.name,
        avatarUrl: row.avatar_url,
        status: row.status,
        role: row.role,
        score: row.score,
        preferredLanguage: row.preferred_language,
        lastLoginAt: row.last_login_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

class UserRepository {
    private readonly selectColumns = `
        clerk_user_id,
        name,
        avatar_url,
        status,
        role,
        score,
        preferred_language,
        last_login_at,
        created_at,
        updated_at
    `;

    // find by clerk user id from user DB
    async findByClerkUserId(clerkUserId: string): Promise<UserRecord | null> {
        const result = await query<UserRow>(
            `SELECT ${this.selectColumns} FROM users WHERE clerk_user_id = $1 LIMIT 1`,
            [clerkUserId],
        );

        if (result.rows.length === 0) {
            return null;
        }

        return mapUserRow(result.rows[0]);
    }

    // update and insert from clerk to user DB
    async upsertFromClerk(input: {
        clerkUserId: string;
        name: string;
        avatarUrl?: string | null;
        preferredLanguage?: string | null;
        lastLoginAt?: Date;
    }): Promise<UserRecord> {
        const hasAvatarUrl = input.avatarUrl !== undefined;
        const hasPreferredLanguage = input.preferredLanguage !== undefined;
        const hasLastLoginAt = input.lastLoginAt instanceof Date;

        const result = await query<UserRow>(
            `
                INSERT INTO users (clerk_user_id, name, avatar_url, role, preferred_language, last_login_at)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (clerk_user_id)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    avatar_url = CASE
                        WHEN $7::boolean THEN EXCLUDED.avatar_url
                        ELSE users.avatar_url
                    END,
                    preferred_language = CASE
                        WHEN $8::boolean THEN EXCLUDED.preferred_language
                        ELSE users.preferred_language
                    END,
                    last_login_at = CASE
                        WHEN $9::boolean THEN EXCLUDED.last_login_at
                        ELSE users.last_login_at
                    END,
                    updated_at = NOW()
                RETURNING ${this.selectColumns}
            `,
            [
                input.clerkUserId,
                input.name,
                input.avatarUrl ?? null,
                "user",
                input.preferredLanguage ?? null,
                input.lastLoginAt || null,
                hasAvatarUrl,
                hasPreferredLanguage,
                hasLastLoginAt,
            ],
        );

        return mapUserRow(result.rows[0]);
    }

    async markDeletedByClerkUserId(clerkUserId: string): Promise<void> {
        await query(
            `
                UPDATE users
                SET status = 'deleted',
                    updated_at = NOW()
                WHERE clerk_user_id = $1
            `,
            [clerkUserId],
        );
    }

    async insertAdminAuditLog(input: {
        id: string;
        actorUserId: string;
        action: AdminAuditAction;
        targetUserId: string;
        metadata?: Record<string, unknown>;
    }): Promise<void> {
        await query(
            `
                INSERT INTO admin_audit_logs (id, actor_user_id, action, target_user_id, metadata)
                VALUES ($1, $2, $3, $4, $5::jsonb)
            `,
            [
                input.id,
                input.actorUserId,
                input.action,
                input.targetUserId,
                JSON.stringify(input.metadata ?? {}),
            ],
        );
    }

    async listByStatuses(statuses: UserStatus[]): Promise<UserRecord[]> {
        const result = await query<UserRow>(
            `
                SELECT ${this.selectColumns}
                FROM users
                WHERE status = ANY($1::text[])
                ORDER BY created_at DESC
            `,
            [statuses],
        );

        return result.rows.map(mapUserRow);
    }

    async updateRoleByClerkUserId(
        clerkUserId: string,
        role: UserRole,
    ): Promise<UserRecord | null> {
        const result = await query<UserRow>(
            `
                UPDATE users
                SET role = $2,
                    updated_at = NOW()
                WHERE clerk_user_id = $1
                RETURNING ${this.selectColumns}
            `,
            [clerkUserId, role],
        );

        if (result.rows.length === 0) {
            return null;
        }

        return mapUserRow(result.rows[0]);
    }

    async updateStatusByClerkUserId(
        clerkUserId: string,
        status: Exclude<UserStatus, "deleted">,
    ): Promise<UserRecord | null> {
        const result = await query<UserRow>(
            `
                UPDATE users
                SET status = $2,
                    updated_at = NOW()
                WHERE clerk_user_id = $1
                RETURNING ${this.selectColumns}
            `,
            [clerkUserId, status],
        );

        if (result.rows.length === 0) {
            return null;
        }

        return mapUserRow(result.rows[0]);
    }

    async updateScoreByClerkUserId(
        clerkUserId: string,
        score: number,
    ): Promise<UserRecord | null> {
        const result = await query<UserRow>(
            `
                UPDATE users
                SET score = $2,
                    updated_at = NOW()
                WHERE clerk_user_id = $1
                RETURNING ${this.selectColumns}
            `,
            [clerkUserId, score],
        );

        if (result.rows.length === 0) {
            return null;
        }

        return mapUserRow(result.rows[0]);
    }
}

export const userRepository = new UserRepository();
