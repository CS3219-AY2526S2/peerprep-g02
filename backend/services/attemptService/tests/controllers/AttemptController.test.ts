import { beforeEach, describe, expect, it, vi } from "vitest";

import { AttemptController } from "../../controllers/AttemptController.js";
import { AttemptService } from "../../services/attemptService.js";
import * as responseHelpers from "../../utils/ResponseHelpers.js";
import { createMockRequest, createMockResponse } from "../helpers/httpMocks.js";

describe("AttemptController", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns bad request when a create payload is missing questionId", async () => {
        const badRequestSpy = vi.spyOn(responseHelpers, "badRequest");
        const createSpy = vi.spyOn(AttemptService.prototype, "recordAttempt");

        const controller = new AttemptController();
        const req = createMockRequest({
            body: {
                userAId: "user_a",
                userBId: "user_b",
                language: "typescript",
                difficulty: "Medium",
                result: "success",
                duration: 1200,
            },
        });
        const res = createMockResponse();

        await controller.create(req, res);

        expect(badRequestSpy).toHaveBeenCalledWith(res, "questionId is required.");
        expect(createSpy).not.toHaveBeenCalled();
    });

    it("returns 201 when an attempt is created successfully", async () => {
        vi.spyOn(AttemptService.prototype, "recordAttempt").mockResolvedValue({
            message: "Attempt recorded successfully.",
            data: {
                attempts: [],
                scoreUpdates: [],
            },
        });

        const controller = new AttemptController();
        const req = createMockRequest({
            body: {
                userAId: "user_a",
                userBId: "user_b",
                questionId: "question-1",
                language: "typescript",
                difficulty: "Medium",
                result: "success",
                duration: 1200,
            },
        });
        const res = createMockResponse();

        await controller.create(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            message: "Attempt recorded successfully.",
            data: {
                attempts: [],
                scoreUpdates: [],
            },
        });
    });

    it("returns 200 for the unique question query", async () => {
        vi.spyOn(AttemptService.prototype, "listUniqueAttemptedQuestions").mockResolvedValue({
            message: "Attempted questions fetched successfully.",
            data: {
                clerkUserId: "user_123",
                questionIds: ["question-1", "question-2"],
            },
        });

        const controller = new AttemptController();
        const req = createMockRequest({
            params: { clerkUserId: "user_123" },
        });
        const res = createMockResponse();

        await controller.listUniqueQuestions(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: "Attempted questions fetched successfully.",
            data: {
                clerkUserId: "user_123",
                questionIds: ["question-1", "question-2"],
            },
        });
    });
});
