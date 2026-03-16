import { randomUUID } from "crypto";

import type { CollaborationSession, CreateSessionRequest, SessionDifficulty } from "@/models/model.js";
import { query } from "@/utils/postgres.js";

type SessionRow = {
    session_id: string;
    pair_key: string;
    user_a_id: string;
    user_b_id: string;
    difficulty: SessionDifficulty;
    language: string;
    topic: string;
    question_id: string;
    status: "active" | "inactive";
    created_at: Date | string;
};

function mapSessionRow(row: SessionRow): CollaborationSession {
    return {
        sessionId: row.session_id,
        pairKey: row.pair_key,
        userAId: row.user_a_id,
        userBId: row.user_b_id,
        difficulty: row.difficulty,
        language: row.language,
        topic: row.topic,
        questionId: row.question_id,
        status: row.status,
        createdAt: new Date(row.created_at).toISOString(),
    };
}

export function buildPairKey(userAId: string, userBId: string): string {
    return [userAId.trim(), userBId.trim()].sort().join(":");
}

class SessionRepository {
    async initialize(): Promise<void> {
        await query(`
            CREATE TABLE IF NOT EXISTS collaboration_sessions (
                session_id UUID PRIMARY KEY,
                pair_key TEXT NOT NULL,
                user_a_id TEXT NOT NULL,
                user_b_id TEXT NOT NULL,
                difficulty TEXT NOT NULL,
                language TEXT NOT NULL,
                topic TEXT NOT NULL,
                question_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT collaboration_sessions_status_check CHECK (status IN ('active', 'inactive')),
                CONSTRAINT collaboration_sessions_difficulty_check CHECK (difficulty IN ('Easy', 'Medium', 'Hard'))
            )
        `);

        await query(`
            CREATE UNIQUE INDEX IF NOT EXISTS collaboration_sessions_active_pair_idx
            ON collaboration_sessions (pair_key)
            WHERE status = 'active'
        `);
    }

    async findActiveByPair(pairKey: string): Promise<CollaborationSession | null> {
        const result = await query<SessionRow>(
            `
                SELECT
                    session_id,
                    pair_key,
                    user_a_id,
                    user_b_id,
                    difficulty,
                    language,
                    topic,
                    question_id,
                    status,
                    created_at
                FROM collaboration_sessions
                WHERE pair_key = $1
                  AND status = 'active'
                LIMIT 1
            `,
            [pairKey],
        );

        const row = result.rows[0];
        return row ? mapSessionRow(row) : null;
    }

    async findBySessionId(sessionId: string): Promise<CollaborationSession | null> {
        const result = await query<SessionRow>(
            `
                SELECT
                    session_id,
                    pair_key,
                    user_a_id,
                    user_b_id,
                    difficulty,
                    language,
                    topic,
                    question_id,
                    status,
                    created_at
                FROM collaboration_sessions
                WHERE session_id = $1
                LIMIT 1
            `,
            [sessionId],
        );

        const row = result.rows[0];
        return row ? mapSessionRow(row) : null;
    }

    async createActiveSession(
        request: CreateSessionRequest,
        questionId: string,
    ): Promise<CollaborationSession> {
        const pairKey = buildPairKey(request.userAId, request.userBId);
        const sessionId = randomUUID();
        const result = await query<SessionRow>(
            `
                INSERT INTO collaboration_sessions (
                    session_id,
                    pair_key,
                    user_a_id,
                    user_b_id,
                    difficulty,
                    language,
                    topic,
                    question_id,
                    status
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
                RETURNING
                    session_id,
                    pair_key,
                    user_a_id,
                    user_b_id,
                    difficulty,
                    language,
                    topic,
                    question_id,
                    status,
                    created_at
            `,
            [
                sessionId,
                pairKey,
                request.userAId,
                request.userBId,
                request.difficulty,
                request.language,
                request.topic,
                questionId,
            ],
        );

        return mapSessionRow(result.rows[0]);
    }
}

export const sessionRepository = new SessionRepository();
