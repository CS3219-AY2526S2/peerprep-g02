import { beforeEach, describe, expect, it, vi } from "vitest";

import { attemptRepository } from "../../models/Attempt.js";
import { AttemptService, calculateScoreDelta } from "../../services/attemptService.js";
import { UserScoreService } from "../../services/userScoreService.js";

describe("AttemptService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("calculates score deltas for success cases", () => {
        expect(calculateScoreDelta("easy", true)).toBe(10);
        expect(calculateScoreDelta("medium", true)).toBe(30);
        expect(calculateScoreDelta("hard", true)).toBe(50);
    });

    it("applies a fail penalty without letting score go below zero", async () => {
        vi.spyOn(attemptRepository, "insert").mockResolvedValue({
            id: "attempt-1",
            clerkUserId: "user_1",
            questionId: "question-1",
            language: "typescript",
            difficulty: "easy",
            success: false,
            duration: 1200,
            attemptedAt: new Date("2026-03-24T00:00:00.000Z"),
            createdAt: new Date("2026-03-24T00:00:00.000Z"),
        });
        vi.spyOn(UserScoreService.prototype, "getScore").mockResolvedValueOnce(5).mockResolvedValueOnce(8);
        const updateScoreSpy = vi
            .spyOn(UserScoreService.prototype, "updateScore")
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(0);

        const service = new AttemptService();
        const result = await service.recordAttempt({
            userAId: "user_1",
            userBId: "user_2",
            questionId: "question-1",
            language: "typescript",
            difficulty: "Easy",
            success: false,
            duration: 1200,
            attemptedAt: "2026-03-24T00:00:00.000Z",
        });

        expect(updateScoreSpy).toHaveBeenNthCalledWith(1, "user_1", 0);
        expect(updateScoreSpy).toHaveBeenNthCalledWith(2, "user_2", 0);
        expect(result.data.scoreUpdates).toEqual([
            {
                clerkUserId: "user_1",
                previousScore: 5,
                newScore: 0,
                delta: -5,
            },
            {
                clerkUserId: "user_2",
                previousScore: 8,
                newScore: 0,
                delta: -8,
            },
        ]);
    });

    it("awards both users for a hard success", async () => {
        vi.spyOn(attemptRepository, "insert").mockResolvedValue({
            id: "attempt-1",
            clerkUserId: "user_1",
            questionId: "question-1",
            language: "typescript",
            difficulty: "hard",
            success: true,
            duration: 1200,
            attemptedAt: new Date("2026-03-24T00:00:00.000Z"),
            createdAt: new Date("2026-03-24T00:00:00.000Z"),
        });
        vi.spyOn(UserScoreService.prototype, "getScore").mockResolvedValueOnce(20).mockResolvedValueOnce(30);
        const updateScoreSpy = vi
            .spyOn(UserScoreService.prototype, "updateScore")
            .mockResolvedValueOnce(70)
            .mockResolvedValueOnce(80);

        const service = new AttemptService();
        await service.recordAttempt({
            userAId: "user_1",
            userBId: "user_2",
            questionId: "question-1",
            language: "typescript",
            difficulty: "Hard",
            success: true,
            duration: 1200,
        });

        expect(updateScoreSpy).toHaveBeenNthCalledWith(1, "user_1", 70);
        expect(updateScoreSpy).toHaveBeenNthCalledWith(2, "user_2", 80);
    });
});
