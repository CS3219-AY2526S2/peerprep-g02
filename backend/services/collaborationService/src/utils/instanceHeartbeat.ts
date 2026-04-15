import { randomUUID } from "node:crypto";

import { logger } from "@/utils/logger.js";
import { getRedisClient } from "@/utils/redis.js";

const LIVENESS_TTL_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 10_000;

const instanceId = randomUUID();
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

export function getInstanceId(): string {
    return instanceId;
}

async function refreshLiveness(): Promise<void> {
    try {
        const redis = getRedisClient();
        await redis.set(`instance:${instanceId}`, "1", "PX", LIVENESS_TTL_MS);
    } catch (err) {
        logger.warn({ err, instanceId }, "Failed to refresh instance liveness key");
    }
}

export async function startInstanceHeartbeat(): Promise<void> {
    await refreshLiveness();
    heartbeatInterval = setInterval(refreshLiveness, HEARTBEAT_INTERVAL_MS);
    logger.info({ instanceId, ttlMs: LIVENESS_TTL_MS, intervalMs: HEARTBEAT_INTERVAL_MS }, "Instance heartbeat started");
}

export async function stopInstanceHeartbeat(): Promise<void> {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }

    try {
        const redis = getRedisClient();
        await redis.del(`instance:${instanceId}`);
        logger.info({ instanceId }, "Instance liveness key deleted (graceful shutdown)");
    } catch (err) {
        logger.warn({ err, instanceId }, "Failed to delete instance liveness key during shutdown");
    }
}
