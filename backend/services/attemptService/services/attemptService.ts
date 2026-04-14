import { randomUUID } from "node:crypto";

import {
    type AttemptDifficulty,
    type AttemptRecord,
    type CreateAttemptInput,
    attemptRepository,
} from "@/models/Attempt.js";
import { UserScoreService } from "@/services/userScoreService.js";
import { ServiceError } from "@/utils/ResponseHelpers.js";
import { QuestionPopularityService } from "./questionPopularService.js";

export type RecordAttemptInput = {
    userId: string;
    collaborationId: string;
    questionId: string;
    questionTitle: string;
    language: string;
    difficulty: string;
    success: boolean;
    duration: number;
    totalTestCases: number;
    testCasesPassed: number;
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

export function calculateScoreDelta(difficulty: AttemptDifficulty, success: boolean): number {
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
    private readonly qnPopularScoreService = new QuestionPopularityService();

    async recordAttempt(input: RecordAttemptInput): Promise<{
        message: string;
        data: {
            attempt: AttemptRecord;
            scoreUpdates: ScoreUpdate[];
        };
    }> {
        const userId = input.userId.trim();
        const collaborationId = input.collaborationId.trim();
        const questionId = input.questionId.trim();
        const language = input.language.trim();

        if (!userId) {
            throw new ServiceError(400, "userId is required.");
        }

        if (!collaborationId) {
            throw new ServiceError(400, "collaborationId is required.");
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
        const newDelta = calculateScoreDelta(difficulty, input.success);
        const questionTitle = input.questionTitle.trim();

        // Check for existing attempt to handle overwrite + score reversal
        const existing = await attemptRepository.findByUserAndCollaboration(userId, collaborationId);
        let netDelta = newDelta;

        if (existing) {
            const oldDelta = calculateScoreDelta(existing.difficulty, existing.success);
            netDelta = newDelta - oldDelta;
            await attemptRepository.deleteByIds([existing.id]);
        }

        const attemptInput: CreateAttemptInput = {
            id: randomUUID(),
            clerkUserId: userId,
            questionId,
            questionTitle,
            collaborationId,
            language,
            difficulty,
            success: input.success,
            duration: input.duration,
            totalTestCases: input.totalTestCases,
            testCasesPassed: input.testCasesPassed,
            attemptedAt,
        };

        const attempt = await attemptRepository.insert(attemptInput);

        try {
            const scoreUpdates = await this.userScoreService.applyScoreDeltas([
                { clerkUserId: userId, delta: netDelta },
            ]);

            await this.qnPopularScoreService.updateQuestionPopularityScore({quid: questionId}).catch(err => console.error(err));

            return {
                message: "Attempt recorded successfully.",
                data: {
                    attempt,
                    scoreUpdates,
                },
            };
        } catch (error) {
            await attemptRepository.deleteByIds([attempt.id]);
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
