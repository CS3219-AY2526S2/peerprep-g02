import { randomUUID } from "node:crypto";

import {
    attemptRepository,
    type AttemptDifficulty,
    type AttemptRecord,
    type CreateAttemptInput,
} from "@/models/Attempt.js";
import { ServiceError } from "@/utils/ResponseHelpers.js";
import { UserScoreService } from "@/services/userScoreService.js";

export type RecordAttemptInput = {
    userAId: string;
    userBId: string;
    questionId: string;
    language: string;
    difficulty: string;
    success: boolean;
    duration: number;
    attemptedAt?: string;
};

type ScoreUpdate = {
    clerkUserId: string;
    previousScore: number;
    newScore: number;
    delta: number;
};

function parseDifficulty(difficulty: string): AttemptDifficulty {
    const normalized = difficulty.trim();

    if (normalized === "Easy" || normalized === "Medium" || normalized === "Hard") {
        return normalized;
    }

    throw new ServiceError(400, "difficulty must be one of: Easy, Medium, Hard.");
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
    success: boolean,
): number {
    if (!success) {
        return -10;
    }

    if (difficulty === "Easy") {
        return 10;
    }

    if (difficulty === "Medium") {
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

        const difficulty = parseDifficulty(input.difficulty);
        const attemptedAt = parseAttemptedAt(input.attemptedAt);
        const scoreDelta = calculateScoreDelta(difficulty, input.success);
        const userIds = [userAId, userBId];
        const attemptInputs: CreateAttemptInput[] = userIds.map((clerkUserId) => ({
            id: randomUUID(),
            clerkUserId,
            questionId,
            language,
            difficulty,
            success: input.success,
            duration: input.duration,
            attemptedAt,
        }));

        const attempts = await Promise.all(
            attemptInputs.map((attemptInput) => attemptRepository.insert(attemptInput)),
        );

        try {
            const scoreUpdates = await this.userScoreService.applyScoreDeltas(
                userIds.map((clerkUserId) => ({
                    clerkUserId,
                    delta: scoreDelta,
                })),
            );

            return {
                message: "Attempt recorded successfully.",
                data: {
                    attempts,
                    scoreUpdates,
                },
            };
        } catch (error) {
            await attemptRepository.deleteByIds(attempts.map((attempt) => attempt.id));
            throw error;
        }
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

    async listAttemptHistory(clerkUserId: string): Promise<{
        message: string;
        data: {
            clerkUserId: string;
            attempts: AttemptRecord[];
        };
    }> {
        const normalizedClerkUserId = clerkUserId.trim();
        if (!normalizedClerkUserId) {
            throw new ServiceError(400, "clerkUserId is required.");
        }

        const attempts = await attemptRepository.listByClerkUserId(normalizedClerkUserId);

        return {
            message: "Attempt history fetched successfully.",
            data: {
                clerkUserId: normalizedClerkUserId,
                attempts,
            },
        };
    }
}
