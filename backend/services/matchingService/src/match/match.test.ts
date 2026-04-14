import { beforeEach, describe, expect, it, vi } from "vitest";

import { RabbitMQManager } from "@/managers/rabbitmqManager.js";
import RedisManager from "@/managers/redisManager.js";
import { attemptRejoin, cancelMatch, findMatch, handleDisconnect } from "@/match/match.js";
import { type Difficulty, type MatchRequest } from "@/types/match.js";

vi.mock("@/managers/redisManager.js");
vi.mock("@/managers/rabbitmqManager.js");
vi.mock("uuid", () => ({ v4: () => "test-uuid-123" }));

describe("Matchmaking Service", () => {
    let mockRedis: any;
    let mockRabbitMQ: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockRedis = {
            eval: vi.fn(),
        };
        mockRabbitMQ = {
            publishCreateSession: vi.fn(),
        };

        (RedisManager.getInstance as any).mockReturnValue(mockRedis);
        (RabbitMQManager.getInstance as any).mockReturnValue(mockRabbitMQ);
    });

    describe("findMatch", () => {
        const mockRequest: MatchRequest = {
            userId: "user-1",
            topics: [{ id: "topic-1", name: "strings" }],
            difficulties: ["Easy"],
            languages: ["python"],
            userScore: 1250,
            scoreRange: 150,
            isUpdate: false,
        };

        it("should return MatchResultPreparing and publish to RabbitMQ when a partner is found", async () => {
            const matchedTopicId = "topic-1";
            const matchedTopicName = "strings";
            const matchedDifficulty: Difficulty = "Easy";
            const matchedLanguage = "python";
            const partnerId = "user-2";

            mockRedis.eval.mockResolvedValue([
                "matched",
                partnerId,
                matchedTopicId,
                matchedDifficulty,
                matchedLanguage,
                "12345678",
            ]);

            mockRabbitMQ.publishCreateSession.mockResolvedValue(true);

            const result = await findMatch(mockRequest);

            expect(mockRedis.eval).toHaveBeenCalled();

            expect(result.matchFound).toBe(true);
            if (result.matchFound) {
                expect(result.matchId).toBe("test-uuid-123");
                expect(result.partnerId).toBe(partnerId);
                expect(result.matchedTopic.id).toBe(matchedTopicId);
                expect(result.matchedTopic.name).toBe(matchedTopicName);
                expect(result.matchedDifficulty).toBe(matchedDifficulty);
                expect(result.matchedLanguage).toBe(matchedLanguage);
            }

            expect(mockRabbitMQ.publishCreateSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    matchId: "test-uuid-123",
                    userAId: "user-1",
                    userBId: partnerId,
                    difficulty: matchedDifficulty,
                    language: matchedLanguage,
                    topicId: matchedTopicId,
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
            expect(mockRabbitMQ.publishCreateSession).not.toHaveBeenCalled();
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
