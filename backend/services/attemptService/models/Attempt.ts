import { query } from "@/utils/postgres.js";

export type AttemptDifficulty = "Easy" | "Medium" | "Hard";

type AttemptRow = {
    id: string;
    clerk_user_id: string;
    question_id: string;
    language: string;
    difficulty: AttemptDifficulty;
    success: boolean;
    duration: number;
    attempted_at: Date;
    created_at: Date;
};

export type AttemptRecord = {
    id: string;
    clerkUserId: string;
    questionId: string;
    language: string;
    difficulty: AttemptDifficulty;
    success: boolean;
    duration: number;
    attemptedAt: Date;
    createdAt: Date;
};

export type CreateAttemptInput = {
    id: string;
    clerkUserId: string;
    questionId: string;
    language: string;
    difficulty: AttemptDifficulty;
    success: boolean;
    duration: number;
    attemptedAt: Date;
};

function mapAttemptRow(row: AttemptRow): AttemptRecord {
    return {
        id: row.id,
        clerkUserId: row.clerk_user_id,
        questionId: row.question_id,
        language: row.language,
        difficulty: row.difficulty,
        success: row.success,
        duration: row.duration,
        attemptedAt: row.attempted_at,
        createdAt: row.created_at,
    };
}

class AttemptRepository {
    private readonly selectColumns = `
        id,
        clerk_user_id,
        question_id,
        language,
        difficulty,
        success,
        duration,
        attempted_at,
        created_at
    `;

    async insert(input: CreateAttemptInput): Promise<AttemptRecord> {
        const result = await query<AttemptRow>(
            `
                INSERT INTO attempts (
                    id,
                    clerk_user_id,
                    question_id,
                    language,
                    difficulty,
                    success,
                    duration,
                    attempted_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING ${this.selectColumns}
            `,
            [
                input.id,
                input.clerkUserId,
                input.questionId,
                input.language,
                input.difficulty,
                input.success,
                input.duration,
                input.attemptedAt,
            ],
        );

        return mapAttemptRow(result.rows[0]);
    }

    async deleteByIds(ids: string[]): Promise<void> {
        if (ids.length === 0) {
            return;
        }

        await query(
            `
                DELETE FROM attempts
                WHERE id = ANY($1::uuid[])
            `,
            [ids],
        );
    }

    async listUniqueQuestionIdsByClerkUserId(clerkUserId: string): Promise<string[]> {
        const result = await query<{ question_id: string }>(
            `
                SELECT DISTINCT question_id
                FROM attempts
                WHERE clerk_user_id = $1
                ORDER BY question_id ASC
            `,
            [clerkUserId],
        );

        return result.rows.map((row) => row.question_id);
    }
}

export const attemptRepository = new AttemptRepository();
