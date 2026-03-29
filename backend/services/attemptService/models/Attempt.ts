import { query } from "@/utils/postgres.js";

export type AttemptDifficulty = "Easy" | "Medium" | "Hard";

type AttemptRow = {
    id: string;
    clerk_user_id: string;
    question_id: string;
    question_title: string;
    language: string;
    difficulty: AttemptDifficulty;
    success: boolean;
    duration: number;
    total_test_cases: number;
    test_cases_passed: number;
    attempted_at: Date;
    created_at: Date;
};

export type AttemptRecord = {
    id: string;
    clerkUserId: string;
    questionId: string;
    questionTitle: string;
    language: string;
    difficulty: AttemptDifficulty;
    success: boolean;
    duration: number;
    totalTestCases: number;
    testCasesPassed: number;
    attemptedAt: Date;
    createdAt: Date;
};

export type CreateAttemptInput = {
    id: string;
    clerkUserId: string;
    questionId: string;
    questionTitle: string;
    language: string;
    difficulty: AttemptDifficulty;
    success: boolean;
    duration: number;
    totalTestCases: number;
    testCasesPassed: number;
    attemptedAt: Date;
};

function mapAttemptRow(row: AttemptRow): AttemptRecord {
    return {
        id: row.id,
        clerkUserId: row.clerk_user_id,
        questionId: row.question_id,
        questionTitle: row.question_title,
        language: row.language,
        difficulty: row.difficulty,
        success: row.success,
        duration: row.duration,
        totalTestCases: row.total_test_cases,
        testCasesPassed: row.test_cases_passed,
        attemptedAt: row.attempted_at,
        createdAt: row.created_at,
    };
}

class AttemptRepository {
    private readonly selectColumns = `
        id,
        clerk_user_id,
        question_id,
        question_title,
        language,
        difficulty,
        success,
        duration,
        total_test_cases,
        test_cases_passed,
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
                    question_title,
                    language,
                    difficulty,
                    success,
                    duration,
                    total_test_cases,
                    test_cases_passed,
                    attempted_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING ${this.selectColumns}
            `,
            [
                input.id,
                input.clerkUserId,
                input.questionId,
                input.questionTitle,
                input.language,
                input.difficulty,
                input.success,
                input.duration,
                input.totalTestCases,
                input.testCasesPassed,
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

    async listByClerkUserId(clerkUserId: string): Promise<AttemptRecord[]> {
        const result = await query<AttemptRow>(
            `
                SELECT ${this.selectColumns}
                FROM attempts
                WHERE clerk_user_id = $1
                ORDER BY attempted_at DESC, created_at DESC
            `,
            [clerkUserId],
        );

        return result.rows.map(mapAttemptRow);
    }
}

export const attemptRepository = new AttemptRepository();
