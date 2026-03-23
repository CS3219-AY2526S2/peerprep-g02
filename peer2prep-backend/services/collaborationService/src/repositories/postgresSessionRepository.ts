import type { CollaborationSession } from "@/models/session.js";
import { query } from "@/utils/postgres.js";
import { logger } from "@/utils/logger.js";

type EndedReason = "both_users_left" | "inactivity_timeout" | "manual";

type SessionHistoryRow = {
    collaboration_id: string;
    match_id: string | null;
    user_a_id: string;
    user_b_id: string;
    difficulty: string;
    language: string;
    topic: string;
    question_id: string;
    status: string;
    final_code: string | null;
    ended_reason: string | null;
    created_at: Date;
    ended_at: Date | null;
};

export type SessionHistory = {
    collaborationId: string;
    matchId?: string;
    userAId: string;
    userBId: string;
    difficulty: string;
    language: string;
    topic: string;
    questionId: string;
    status: string;
    finalCode?: string;
    endedReason?: EndedReason;
    createdAt: Date;
    endedAt?: Date;
};

function rowToSessionHistory(row: SessionHistoryRow): SessionHistory {
    return {
        collaborationId: row.collaboration_id,
        matchId: row.match_id ?? undefined,
        userAId: row.user_a_id,
        userBId: row.user_b_id,
        difficulty: row.difficulty,
        language: row.language,
        topic: row.topic,
        questionId: row.question_id,
        status: row.status,
        finalCode: row.final_code ?? undefined,
        endedReason: (row.ended_reason as EndedReason) ?? undefined,
        createdAt: row.created_at,
        endedAt: row.ended_at ?? undefined,
    };
}

export class PostgresSessionRepository {
    async insertSession(session: CollaborationSession): Promise<void> {
        try {
            await query(
                `
                INSERT INTO collaboration_sessions (
                    collaboration_id,
                    match_id,
                    user_a_id,
                    user_b_id,
                    difficulty,
                    language,
                    topic,
                    question_id,
                    status,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (collaboration_id) DO NOTHING
            `,
                [
                    session.collaborationId,
                    session.matchId ?? null,
                    session.userAId,
                    session.userBId,
                    session.difficulty,
                    session.language,
                    session.topic,
                    session.questionId,
                    session.status,
                    new Date(session.createdAt),
                ],
            );

            logger.debug(
                { collaborationId: session.collaborationId },
                "Session inserted into PostgreSQL",
            );
        } catch (error) {
            logger.error(
                { err: error, collaborationId: session.collaborationId },
                "Failed to insert session into PostgreSQL",
            );
            throw error;
        }
    }

    async updateSessionEnded(
        collaborationId: string,
        finalCode: string,
        endedReason: EndedReason,
    ): Promise<void> {
        try {
            const result = await query(
                `
                UPDATE collaboration_sessions
                SET
                    status = 'inactive',
                    final_code = $2,
                    ended_reason = $3,
                    ended_at = NOW()
                WHERE collaboration_id = $1
            `,
                [collaborationId, finalCode, endedReason],
            );

            if (result.rowCount === 0) {
                logger.warn(
                    { collaborationId },
                    "No session found to update in PostgreSQL",
                );
            } else {
                logger.debug(
                    { collaborationId, endedReason },
                    "Session ended in PostgreSQL",
                );
            }
        } catch (error) {
            logger.error(
                { err: error, collaborationId },
                "Failed to update session ended in PostgreSQL",
            );
            throw error;
        }
    }

    async getSessionById(collaborationId: string): Promise<SessionHistory | null> {
        const result = await query<SessionHistoryRow>(
            `
            SELECT *
            FROM collaboration_sessions
            WHERE collaboration_id = $1
        `,
            [collaborationId],
        );

        if (result.rows.length === 0) {
            return null;
        }

        return rowToSessionHistory(result.rows[0]);
    }

    async getSessionsByUser(
        userId: string,
        options: { limit?: number; offset?: number } = {},
    ): Promise<SessionHistory[]> {
        const { limit = 20, offset = 0 } = options;

        const result = await query<SessionHistoryRow>(
            `
            SELECT *
            FROM collaboration_sessions
            WHERE user_a_id = $1 OR user_b_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        `,
            [userId, limit, offset],
        );

        return result.rows.map(rowToSessionHistory);
    }

    async getRecentSessions(options: { limit?: number; offset?: number } = {}): Promise<SessionHistory[]> {
        const { limit = 50, offset = 0 } = options;

        const result = await query<SessionHistoryRow>(
            `
            SELECT *
            FROM collaboration_sessions
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
        `,
            [limit, offset],
        );

        return result.rows.map(rowToSessionHistory);
    }
}
