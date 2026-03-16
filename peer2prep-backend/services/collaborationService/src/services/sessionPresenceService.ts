import { getRedisClient } from "@/utils/redis.js";
import { redisLogger } from "@/utils/logger.js";

const inMemoryPresence = new Map<string, Set<string>>();
const sessionTtlSeconds = Number(process.env.CS_SESSION_TTL_SECONDS ?? "7200");
const presencePrefix = "collaboration:presence";

function buildPresenceKey(sessionId: string): string {
    return `${presencePrefix}:${sessionId}`;
}

type PresenceJoinResult =
    | { allowed: true; participantCount: number }
    | { allowed: false; participantCount: number };

class SessionPresenceService {
    async join(sessionId: string, userId: string): Promise<PresenceJoinResult> {
        const redis = getRedisClient();

        if (!redis) {
            const participants = inMemoryPresence.get(sessionId) ?? new Set<string>();
            participants.add(userId);
            inMemoryPresence.set(sessionId, participants);

            return {
                allowed: participants.size <= 2,
                participantCount: participants.size,
            };
        }

        const key = buildPresenceKey(sessionId);

        try {
            const participantCount = await redis.sAdd(key, userId);
            await redis.expire(key, sessionTtlSeconds);
            const distinctParticipants = await redis.sCard(key);

            return {
                allowed: distinctParticipants <= 2,
                participantCount: distinctParticipants,
            };
        } catch (error) {
            redisLogger.warn({ err: error, sessionId, userId }, "Failed to update session presence in Redis");
            const participants = inMemoryPresence.get(sessionId) ?? new Set<string>();
            participants.add(userId);
            inMemoryPresence.set(sessionId, participants);

            return {
                allowed: participants.size <= 2,
                participantCount: participants.size,
            };
        }
    }
}

export const sessionPresenceService = new SessionPresenceService();
