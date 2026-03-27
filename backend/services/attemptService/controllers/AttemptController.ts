import type { Request, Response } from "express";

import { AttemptService } from "@/services/attemptService.js";
import { badRequest, handleError } from "@/utils/ResponseHelpers.js";

type RecordAttemptRequest = {
    userAId?: string;
    userBId?: string;
    questionId?: string;
    language?: string;
    difficulty?: string;
    success?: boolean;
    duration?: number;
    attemptedAt?: string;
    timestamp?: string;
};

export class AttemptController {
    private readonly attemptService = new AttemptService();

    async create(req: Request, res: Response): Promise<Response | void> {
        const body = req.body as RecordAttemptRequest | undefined;

        if (typeof body?.userAId !== "string" || typeof body?.userBId !== "string") {
            return badRequest(res, "userAId and userBId are required.");
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

        try {
            const response = await this.attemptService.recordAttempt({
                userAId: body.userAId,
                userBId: body.userBId,
                questionId: body.questionId,
                language: body.language,
                difficulty: body.difficulty,
                success: body.success,
                duration: body.duration,
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
