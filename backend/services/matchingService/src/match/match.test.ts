import { beforeEach, describe, expect, it, vi } from "vitest";

import RedisManager from "@/managers/redisManager.js";
import { attemptRejoin, cancelMatch, findMatch, handleDisconnect } from "@/match/match.js";
import { createCollaborationSession } from "@/services/collaborationService.js";
import { type Difficulty, type MatchRequest } from "@/types/match.js";

vi.mock("@/managers/redisManager.js");
vi.mock("@/services/collaborationService.js");
vi.mock("uuid", () => ({ v4: () => "test-uuid-123" }));

describe("Matchmaking Service", () => {
    let mockRedis: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockRedis = {
            eval: vi.fn(),
        };
        (RedisManager.getInstance as any).mockReturnValue(mockRedis);
    });

    describe("findMatch", () => {
        const mockRequest: MatchRequest = {
            userId: "user-1",
            topics: ["strings"],
            difficulties: ["Easy"],
            languages: ["python"],
            userScore: 1250,
            scoreRange: 150,
            isUpdate: false,
        };

        it("should return MatchResultSuccess when a partner is found", async () => {
            const matchedTopic = "strings";
            const matchedDifficulty: Difficulty = "Easy";
            const matchedLanguage = "python";
            const partnerId = "user-2";

            mockRedis.eval.mockResolvedValue([
                "matched",
                partnerId,
                matchedTopic,
                matchedDifficulty,
                matchedLanguage,
                "12345678",
            ]);

            (createCollaborationSession as any).mockResolvedValue("collab-id-999");

            const result = await findMatch(mockRequest);

            expect(mockRedis.eval).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    arguments: expect.arrayContaining([
                        mockRequest.userScore.toString(),
                        mockRequest.scoreRange.toString(),
                    ]),
                    keys: expect.arrayContaining([`mm:us:${mockRequest.userId}`]),
                }),
            );

            expect(result.matchFound).toBe(true);
            if (result.matchFound) {
                expect(result.collaborationId).toBe("collab-id-999");
                expect(result.matchId).toBe("test-uuid-123");
                expect(result.partnerId).toBe(partnerId);
                expect(result.matchedTopic).toBe(matchedTopic);
                expect(result.matchedDifficulty).toBe(matchedDifficulty);
                expect(result.matchedLanguage).toBe(matchedLanguage);
            }

            expect(createCollaborationSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    userAId: "user-1",
                    userBId: partnerId,
                    difficulty: matchedDifficulty,
                    language: matchedLanguage,
                    topic: matchedTopic,
                }),
            );
        });

        it("should return MatchResultWaiting if no partner is found", async () => {
            const startTimeStr = "1700000000";
            mockRedis.eval.mockResolvedValue(["enqueued", "", "", "", "", startTimeStr]);

            const result = await findMatch(mockRequest);

            expect(result.matchFound).toBe(false);
            if (!result.matchFound) {
                expect(result.startTime).toBe(parseInt(startTimeStr, 10));
            }
        });

        it("should fallback to MatchResultWaiting if collaboration creation fails", async () => {
            mockRedis.eval.mockResolvedValue(["matched", "user-2", "strings", "Easy", "python", "12345678"]);
            (createCollaborationSession as any).mockResolvedValue(null);

            const result = await findMatch(mockRequest);

            expect(result.matchFound).toBe(false);
        });
    });

    describe("attemptRejoin", () => {
        it("should return success and startTime when user can rejoin", async () => {
            const startTimeStr = "12345678";
            mockRedis.eval.mockResolvedValue(["success", startTimeStr]);

            const result = await attemptRejoin("user-1");

            expect(result.success).toBe(true);
            expect(result.startTime).toBe(parseInt(startTimeStr, 10));
        });

        it("should return success false if user cannot rejoin", async () => {
            mockRedis.eval.mockResolvedValue(["fail", undefined]);

            const result = await attemptRejoin("user-1");

            expect(result.success).toBe(false);
            expect(result.startTime).toBeUndefined();
        });
    });

    describe("handleDisconnect", () => {
        it("should return true when disconnect script returns ok", async () => {
            mockRedis.eval.mockResolvedValue(["ok"]);
            const result = await handleDisconnect("user-1");
            expect(result).toBe(true);
        });
    });

    describe("cancelMatch", () => {
        it("should return true when cancel script returns ok", async () => {
            mockRedis.eval.mockResolvedValue(["ok"]);
            const result = await cancelMatch("user-1");
            expect(result).toBe(true);
        });
    });
});
