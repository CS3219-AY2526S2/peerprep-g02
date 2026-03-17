/** Creates shared service-level singleton instances such as the Redis-backed session cache. */
import { collaborationConfig } from "@/services/config.js";
import { SessionCache } from "@/services/sessionCache.js";
import { redisClient } from "@/utils/redis.js";

export const sessionCache = new SessionCache(
    redisClient,
    collaborationConfig.sessionTtlMs,
);
