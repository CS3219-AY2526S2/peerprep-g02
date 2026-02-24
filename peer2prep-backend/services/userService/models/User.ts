import { query } from "../utils/postgres.js";

export type UserStatus = "active" | "suspended" | "deleted";
export type UserRole = "user" | "admin";

type UserRow = {
    clerk_user_id: string;
    name: string;
    avatar_url: string | null;
    status: UserStatus;
    role: UserRole;
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
        lastLoginAt?: Date;
    }): Promise<UserRecord> {
        const hasLastLoginAt = input.lastLoginAt instanceof Date;
        const result = await query<UserRow>(
            `
                INSERT INTO users (clerk_user_id, name, role, last_login_at)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (clerk_user_id)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    last_login_at = CASE
                        WHEN $5::boolean THEN EXCLUDED.last_login_at
                        ELSE users.last_login_at
                    END,
                    updated_at = NOW()
                RETURNING ${this.selectColumns}
            `,
            [input.clerkUserId, input.name, "user", input.lastLoginAt || null, hasLastLoginAt],
        );

        return mapUserRow(result.rows[0]);
    }
}

export const userRepository = new UserRepository();
