import type { CollaborationSession } from "@/models/model.js";
import { getRedisClient } from "@/utils/redis.js";
import { redisLogger } from "@/utils/logger.js";

const sessionTtlSeconds = Number(process.env.CS_SESSION_TTL_SECONDS ?? "7200");
const sessionCachePrefix = "collaboration:session";

function buildSessionCacheKey(sessionId: string): string {
    return `${sessionCachePrefix}:${sessionId}`;
}

class SessionCache {
    async cacheSession(session: CollaborationSession): Promise<boolean> {
        const redis = getRedisClient();

        if (!redis) {
            return false;
        }

        try {
            await redis.set(buildSessionCacheKey(session.sessionId), JSON.stringify(session), {
                EX: sessionTtlSeconds,
            });
            return true;
        } catch (error) {
            redisLogger.warn({ err: error, sessionId: session.sessionId }, "Failed to cache session");
            return false;
        }
    }
}

export const sessionCache = new SessionCache();
