import { collaborationConfig } from "@/services/config.js";
import { SessionCache } from "@/services/sessionCache.js";
import { redisClient } from "@/utils/redis.js";

export const sessionCache = new SessionCache(
    redisClient,
    collaborationConfig.sessionTtlMs,
);
