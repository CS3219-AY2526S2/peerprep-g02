import { beforeEach, describe, expect, it, vi } from "vitest";

import { InternalUserScoreController } from "../../controllers/InternalUserScoreController.js";
import { userRepository } from "../../models/User.js";
import { createMockRequest, createMockResponse } from "../helpers/httpMocks.js";

describe("InternalUserScoreController", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns the user's score for a valid clerkUserId", async () => {
        vi.spyOn(userRepository, "findByClerkUserId").mockResolvedValue({
            clerkUserId: "user_123",
            name: "Alice",
            avatarUrl: null,
            status: "active",
            role: "user",
            score: 30,
            preferredLanguage: null,
            lastLoginAt: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        });

        const controller = new InternalUserScoreController();
        const req = createMockRequest({
            params: { clerkUserId: "user_123" } as any,
        });
        const res = createMockResponse();

        await controller.getScore(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            data: {
                user: {
                    clerkUserId: "user_123",
                    score: 30,
                },
            },
        });
    });

    it("rejects negative score updates", async () => {
        const updateScoreSpy = vi.spyOn(userRepository, "updateScoreByClerkUserId");

        const controller = new InternalUserScoreController();
        const req = createMockRequest({
            params: { clerkUserId: "user_123" } as any,
            body: { score: -10 },
        });
        const res = createMockResponse();

        await controller.updateScore(req, res);

        expect(updateScoreSpy).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: "score must be a non-negative integer.",
        });
    });

    it("updates a user's score when the payload is valid", async () => {
        vi.spyOn(userRepository, "updateScoreByClerkUserId").mockResolvedValue({
            clerkUserId: "user_123",
            name: "Alice",
            avatarUrl: null,
            status: "active",
            role: "user",
            score: 50,
            preferredLanguage: null,
            lastLoginAt: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        });

        const controller = new InternalUserScoreController();
        const req = createMockRequest({
            params: { clerkUserId: "user_123" } as any,
            body: { score: 50 },
        });
        const res = createMockResponse();

        await controller.updateScore(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: "User score updated successfully.",
            data: {
                user: {
                    clerkUserId: "user_123",
                    score: 50,
                },
            },
        });
    });
});
