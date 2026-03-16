import { createClient } from "redis";

import { redisLogger } from "@/utils/logger.js";

const redisUrl = process.env.CS_REDIS_URL ?? process.env.REDIS_URL;

type CollaborationRedisClient = ReturnType<typeof createClient>;

let redisClient: CollaborationRedisClient | null = null;
let redisReady = false;
let connectAttempted = false;

function buildRedisClient(): CollaborationRedisClient {
    const client = createClient(redisUrl ? { url: redisUrl } : undefined);

    client.on("error", (error) => {
        redisReady = false;
        redisLogger.warn({ err: error }, "Redis client error");
    });

    client.on("ready", () => {
        redisReady = true;
        redisLogger.info("Redis client ready");
    });

    client.on("end", () => {
        redisReady = false;
        redisLogger.warn("Redis client connection closed");
    });

    return client;
}

export async function connectRedis(): Promise<void> {
    if (!redisUrl || connectAttempted) {
        return;
    }

    connectAttempted = true;
    redisClient = buildRedisClient();

    try {
        await redisClient.connect();
    } catch (error) {
        redisReady = false;
        redisLogger.warn({ err: error }, "Redis unavailable; continuing without cache");
    }
}

export function getRedisClient(): CollaborationRedisClient | null {
    if (!redisReady || !redisClient?.isOpen) {
        return null;
    }

    return redisClient;
}

export async function closeRedis(): Promise<void> {
    if (redisClient?.isOpen) {
        await redisClient.quit();
    }

    redisClient = null;
    redisReady = false;
    connectAttempted = false;
}
