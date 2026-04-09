import type { Request, Response } from "express";

import { AttemptService } from "@/services/attemptService.js";
import { badRequest, handleError } from "@/utils/ResponseHelpers.js";

type RecordAttemptRequest = {
    userId?: string;
    collaborationId?: string;
    questionId?: string;
    questionTitle?: string;
    language?: string;
    difficulty?: string;
    success?: boolean;
    duration?: number;
    totalTestCases?: number;
    testCasesPassed?: number;
    attemptedAt?: string;
    timestamp?: string;
};

export class AttemptController {
    private readonly attemptService = new AttemptService();

    async create(req: Request, res: Response): Promise<Response | void> {
        const body = req.body as RecordAttemptRequest | undefined;

        if (typeof body?.userId !== "string" || body.userId.trim().length === 0) {
            return badRequest(res, "userId is required.");
        }

        if (typeof body?.collaborationId !== "string" || body.collaborationId.trim().length === 0) {
            return badRequest(res, "collaborationId is required.");
        }

        if (typeof body?.questionId !== "string" || body.questionId.trim().length === 0) {
            return badRequest(res, "questionId is required.");
        }

        if (typeof body?.language !== "string" || body.language.trim().length === 0) {
            return badRequest(res, "language is required.");
        }

        if (typeof body?.difficulty !== "string" || body.difficulty.trim().length === 0) {
            return badRequest(res, "difficulty is required.");
        }

        if (typeof body?.success !== "boolean") {
            return badRequest(res, "success must be either true or false.");
        }

        if (typeof body?.duration !== "number") {
            return badRequest(res, "duration is required.");
        }

        if (typeof body?.questionTitle !== "string") {
            return badRequest(res, "questionTitle is required.");
        }

        if (typeof body?.totalTestCases !== "number" || body.totalTestCases < 0) {
            return badRequest(res, "totalTestCases must be a non-negative number.");
        }

        if (typeof body?.testCasesPassed !== "number" || body.testCasesPassed < 0) {
            return badRequest(res, "testCasesPassed must be a non-negative number.");
        }

        try {
            const response = await this.attemptService.recordAttempt({
                userId: body.userId,
                collaborationId: body.collaborationId,
                questionId: body.questionId,
                questionTitle: body.questionTitle,
                language: body.language,
                difficulty: body.difficulty,
                success: body.success,
                duration: body.duration,
                totalTestCases: body.totalTestCases,
                testCasesPassed: body.testCasesPassed,
                attemptedAt:
                    typeof body.attemptedAt === "string" ? body.attemptedAt : body.timestamp,
            });

            return res.status(201).json(response);
        } catch (error) {
            handleError(res, error, "create attempt");
        }
    }

    async listUniqueQuestions(req: Request, res: Response): Promise<Response | void> {
        const clerkUserId = req.params.clerkUserId;

        if (!clerkUserId) {
            return badRequest(res, "clerkUserId is required.");
        }

        try {
            const response = await this.attemptService.listUniqueAttemptedQuestions(clerkUserId);
            return res.status(200).json(response);
        } catch (error) {
            handleError(res, error, "fetch attempted questions");
        }
    }

    async listAttemptsForCurrentUser(_req: Request, res: Response): Promise<Response | void> {
        const clerkUserId = res.locals.clerkUserId as string | undefined;

        if (!clerkUserId) {
            return res.status(500).json({ error: "Authenticated user context is missing." });
        }

        try {
            const response = await this.attemptService.listAttemptHistory(clerkUserId);
            return res.status(200).json(response);
        } catch (error) {
            handleError(res, error, "fetch attempt history");
        }
    }
}
