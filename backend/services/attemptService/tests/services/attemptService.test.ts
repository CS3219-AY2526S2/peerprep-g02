import { beforeEach, describe, expect, it, vi } from "vitest";

import { attemptRepository } from "../../models/Attempt.js";
import { AttemptService, calculateScoreDelta } from "../../services/attemptService.js";
import { UserScoreService } from "../../services/userScoreService.js";

describe("AttemptService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("calculates score deltas for success cases", () => {
        expect(calculateScoreDelta("Easy", true)).toBe(10);
        expect(calculateScoreDelta("Medium", true)).toBe(30);
        expect(calculateScoreDelta("Hard", true)).toBe(50);
    });

    it("applies a fail penalty without letting score go below zero", async () => {
        vi.spyOn(attemptRepository, "findByUserAndCollaboration").mockResolvedValue(null);
        vi.spyOn(attemptRepository, "insert").mockResolvedValue({
            id: "attempt-1",
            clerkUserId: "user_1",
            questionId: "question-1",
            questionTitle: "Two Sum",
            collaborationId: "collab-1",
            language: "typescript",
            difficulty: "Easy",
            success: false,
            duration: 1200,
            totalTestCases: 5,
            testCasesPassed: 2,
            attemptedAt: new Date("2026-03-24T00:00:00.000Z"),
            createdAt: new Date("2026-03-24T00:00:00.000Z"),
        });
        const applyScoreDeltasSpy = vi
            .spyOn(UserScoreService.prototype, "applyScoreDeltas")
            .mockResolvedValue([
                {
                    clerkUserId: "user_1",
                    previousScore: 5,
                    newScore: 0,
                    delta: -5,
                },
            ]);

        const service = new AttemptService();
        const result = await service.recordAttempt({
            userId: "user_1",
            collaborationId: "collab-1",
            questionId: "question-1",
            questionTitle: "Two Sum",
            language: "typescript",
            difficulty: "Easy",
            success: false,
            duration: 1200,
            totalTestCases: 5,
            testCasesPassed: 2,
            attemptedAt: "2026-03-24T00:00:00.000Z",
        });

        expect(applyScoreDeltasSpy).toHaveBeenCalledWith([
            {
                clerkUserId: "user_1",
                delta: -10,
            },
        ]);
        expect(result.data.scoreUpdates).toEqual([
            {
                clerkUserId: "user_1",
                previousScore: 5,
                newScore: 0,
                delta: -5,
            },
        ]);
    });

    it("awards the user for a hard success", async () => {
        vi.spyOn(attemptRepository, "findByUserAndCollaboration").mockResolvedValue(null);
        vi.spyOn(attemptRepository, "insert").mockResolvedValue({
            id: "attempt-1",
            clerkUserId: "user_1",
            questionId: "question-1",
            questionTitle: "Two Sum",
            collaborationId: "collab-1",
            language: "typescript",
            difficulty: "Hard",
            success: true,
            duration: 1200,
            totalTestCases: 5,
            testCasesPassed: 5,
            attemptedAt: new Date("2026-03-24T00:00:00.000Z"),
            createdAt: new Date("2026-03-24T00:00:00.000Z"),
        });
        const applyScoreDeltasSpy = vi
            .spyOn(UserScoreService.prototype, "applyScoreDeltas")
            .mockResolvedValue([
                {
                    clerkUserId: "user_1",
                    previousScore: 20,
                    newScore: 70,
                    delta: 50,
                },
            ]);

        const service = new AttemptService();
        await service.recordAttempt({
            userId: "user_1",
            collaborationId: "collab-1",
            questionId: "question-1",
            questionTitle: "Two Sum",
            language: "typescript",
            difficulty: "Hard",
            success: true,
            duration: 1200,
            totalTestCases: 5,
            testCasesPassed: 5,
        });

        expect(applyScoreDeltasSpy).toHaveBeenCalledWith([
            {
                clerkUserId: "user_1",
                delta: 50,
            },
        ]);
    });

    it("deletes inserted attempts when score updates fail", async () => {
        vi.spyOn(attemptRepository, "findByUserAndCollaboration").mockResolvedValue(null);
        vi.spyOn(attemptRepository, "insert").mockResolvedValueOnce({
            id: "attempt-1",
            clerkUserId: "user_1",
            questionId: "question-1",
            questionTitle: "Two Sum",
            collaborationId: "collab-1",
            language: "typescript",
            difficulty: "Medium",
            success: true,
            duration: 1200,
            totalTestCases: 5,
            testCasesPassed: 5,
            attemptedAt: new Date("2026-03-24T00:00:00.000Z"),
            createdAt: new Date("2026-03-24T00:00:00.000Z"),
        });
        const deleteByIdsSpy = vi.spyOn(attemptRepository, "deleteByIds").mockResolvedValue();
        vi.spyOn(UserScoreService.prototype, "applyScoreDeltas").mockRejectedValue(
            new Error("score update failed"),
        );

        const service = new AttemptService();

        await expect(
            service.recordAttempt({
                userId: "user_1",
                collaborationId: "collab-1",
                questionId: "question-1",
                questionTitle: "Two Sum",
                language: "typescript",
                difficulty: "Medium",
                success: true,
                duration: 1200,
                totalTestCases: 5,
                testCasesPassed: 5,
            }),
        ).rejects.toThrow("score update failed");

        expect(deleteByIdsSpy).toHaveBeenCalledWith(["attempt-1"]);
    });

    it("returns attempt history from stored attempt records", async () => {
        vi.spyOn(attemptRepository, "listByClerkUserId").mockResolvedValue([
            {
                id: "attempt-1",
                clerkUserId: "user_1",
                questionId: "question-1",
                questionTitle: "Two Sum",
                collaborationId: "collab-1",
                language: "typescript",
                difficulty: "Easy",
                success: true,
                duration: 900,
                totalTestCases: 5,
                testCasesPassed: 5,
                attemptedAt: new Date("2026-03-24T00:00:00.000Z"),
                createdAt: new Date("2026-03-24T00:00:00.000Z"),
            },
            {
                id: "attempt-2",
                clerkUserId: "user_1",
                questionId: "question-2",
                questionTitle: "Add Two Numbers",
                collaborationId: "collab-2",
                language: "python",
                difficulty: "Medium",
                success: false,
                duration: 1800,
                totalTestCases: 3,
                testCasesPassed: 1,
                attemptedAt: new Date("2026-03-25T00:00:00.000Z"),
                createdAt: new Date("2026-03-25T00:00:00.000Z"),
            },
        ]);

        const service = new AttemptService();
        const result = await service.listAttemptHistory("user_1");

        expect(attemptRepository.listByClerkUserId).toHaveBeenCalledWith("user_1");
        expect(result).toEqual({
            message: "Attempt history fetched successfully.",
            data: {
                clerkUserId: "user_1",
                attempts: [
                    {
                        id: "attempt-1",
                        clerkUserId: "user_1",
                        questionId: "question-1",
                        questionTitle: "Two Sum",
                        collaborationId: "collab-1",
                        language: "typescript",
                        difficulty: "Easy",
                        success: true,
                        duration: 900,
                        totalTestCases: 5,
                        testCasesPassed: 5,
                        attemptedAt: new Date("2026-03-24T00:00:00.000Z"),
                        createdAt: new Date("2026-03-24T00:00:00.000Z"),
                    },
                    {
                        id: "attempt-2",
                        clerkUserId: "user_1",
                        questionId: "question-2",
                        questionTitle: "Add Two Numbers",
                        collaborationId: "collab-2",
                        language: "python",
                        difficulty: "Medium",
                        success: false,
                        duration: 1800,
                        totalTestCases: 3,
                        testCasesPassed: 1,
                        attemptedAt: new Date("2026-03-25T00:00:00.000Z"),
                        createdAt: new Date("2026-03-25T00:00:00.000Z"),
                    },
                ],
            },
        });
    });
});
