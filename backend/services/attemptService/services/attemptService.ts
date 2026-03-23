import { randomUUID } from "node:crypto";

import {
    attemptRepository,
    type AttemptDifficulty,
    type AttemptRecord,
    type AttemptResult,
} from "../models/Attempt.js";
import { ServiceError } from "../utils/ResponseHelpers.js";
import { UserScoreService } from "./userScoreService.js";

export type RecordAttemptInput = {
    userAId: string;
    userBId: string;
    questionId: string;
    language: string;
    difficulty: string;
    result: string | boolean;
    duration: number;
    attemptedAt?: string;
};

type ScoreUpdate = {
    clerkUserId: string;
    previousScore: number;
    newScore: number;
    delta: number;
};

function normalizeDifficulty(difficulty: string): AttemptDifficulty {
    const normalized = difficulty.trim().toLowerCase();

    if (normalized === "easy" || normalized === "medium" || normalized === "hard") {
        return normalized;
    }

    throw new ServiceError(400, "difficulty must be one of: easy, medium, hard.");
}

function normalizeResult(result: string | boolean): AttemptResult {
    if (typeof result === "boolean") {
        return result ? "success" : "fail";
    }

    const normalized = result.trim().toLowerCase();
    if (normalized === "success") {
        return "success";
    }

    if (normalized === "fail" || normalized === "failed") {
        return "fail";
    }

    throw new ServiceError(400, "result must be either 'success' or 'fail'.");
}

function parseAttemptedAt(attemptedAt?: string): Date {
    if (!attemptedAt) {
        return new Date();
    }

    const parsed = new Date(attemptedAt);
    if (Number.isNaN(parsed.getTime())) {
        throw new ServiceError(400, "attemptedAt must be a valid ISO date string.");
    }

    return parsed;
}

export function calculateScoreDelta(
    difficulty: AttemptDifficulty,
    result: AttemptResult,
): number {
    if (result === "fail") {
        return -10;
    }

    if (difficulty === "easy") {
        return 10;
    }

    if (difficulty === "medium") {
        return 30;
    }

    return 50;
}

export class AttemptService {
    private readonly userScoreService = new UserScoreService();

    async recordAttempt(input: RecordAttemptInput): Promise<{
        message: string;
        data: {
            attempts: AttemptRecord[];
            scoreUpdates: ScoreUpdate[];
        };
    }> {
        const userAId = input.userAId.trim();
        const userBId = input.userBId.trim();
        const questionId = input.questionId.trim();
        const language = input.language.trim();

        if (!userAId || !userBId) {
            throw new ServiceError(400, "userAId and userBId are required.");
        }

        if (userAId === userBId) {
            throw new ServiceError(400, "userAId and userBId must be different.");
        }

        if (!questionId) {
            throw new ServiceError(400, "questionId is required.");
        }

        if (!language) {
            throw new ServiceError(400, "language is required.");
        }

        if (!Number.isFinite(input.duration) || input.duration < 0) {
            throw new ServiceError(400, "duration must be a non-negative number.");
        }

        const difficulty = normalizeDifficulty(input.difficulty);
        const result = normalizeResult(input.result);
        const attemptedAt = parseAttemptedAt(input.attemptedAt);
        const scoreDelta = calculateScoreDelta(difficulty, result);
        const userIds = [userAId, userBId];

        const attempts = await Promise.all(
            userIds.map((clerkUserId) =>
                attemptRepository.insert({
                    id: randomUUID(),
                    clerkUserId,
                    questionId,
                    language,
                    difficulty,
                    result,
                    duration: input.duration,
                    attemptedAt,
                }),
            ),
        );

        const scoreUpdates = await Promise.all(
            userIds.map(async (clerkUserId) => {
                const previousScore = await this.userScoreService.getScore(clerkUserId);
                const nextScore = Math.max(0, previousScore + scoreDelta);
                const newScore = await this.userScoreService.updateScore(clerkUserId, nextScore);

                return {
                    clerkUserId,
                    previousScore,
                    newScore,
                    delta: newScore - previousScore,
                };
            }),
        );

        return {
            message: "Attempt recorded successfully.",
            data: {
                attempts,
                scoreUpdates,
            },
        };
    }

    async listUniqueAttemptedQuestions(clerkUserId: string): Promise<{
        message: string;
        data: {
            clerkUserId: string;
            questionIds: string[];
        };
    }> {
        const normalizedClerkUserId = clerkUserId.trim();
        if (!normalizedClerkUserId) {
            throw new ServiceError(400, "clerkUserId is required.");
        }

        const questionIds =
            await attemptRepository.listUniqueQuestionIdsByClerkUserId(normalizedClerkUserId);

        return {
            message: "Attempted questions fetched successfully.",
            data: {
                clerkUserId: normalizedClerkUserId,
                questionIds,
            },
        };
    }
}
