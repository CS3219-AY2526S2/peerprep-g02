import { env } from "@/config/env.js";
import { logger } from "@/utils/logger.js";
import { getRedisClient } from "@/utils/redis.js";

/**
 * On startup, every `socket:<id>` key in Redis is orphaned because no
 * Socket.IO server was running. This function removes them and corrects
 * the associated presence state so users are not shown as "connected"
 * when they are not.
 */
export async function reconcileOrphanedSockets(): Promise<void> {
    const redis = getRedisClient();
    const prefix = env.redisKeyPrefix;

    // Collect all orphaned socket keys via cursor-based SCAN
    const orphanedSocketIds: string[] = [];
    let cursor = "0";

    do {
        // ioredis does not auto-prepend keyPrefix to SCAN MATCH, so use full prefix
        const [nextCursor, keys] = await redis.scan(
            cursor,
            "MATCH",
            `${prefix}socket:*`,
            "COUNT",
            100,
        );
        cursor = nextCursor;

        for (const rawKey of keys) {
            const key = rawKey.startsWith(prefix) ? rawKey.slice(prefix.length) : rawKey;
            if (key.startsWith("socket:")) {
                orphanedSocketIds.push(key.slice("socket:".length));
            }
        }
    } while (cursor !== "0");

    if (orphanedSocketIds.length === 0) {
        return;
    }

    logger.info({ count: orphanedSocketIds.length }, "Cleaning up orphaned socket bindings");

    // Track affected (collabId, userId) pairs so we can fix their presence afterwards
    const affected = new Map<string, Set<string>>(); // collabId -> Set<userId>

    // Phase 1: delete socket keys and remove from session socket sets
    const pipeline = redis.pipeline();

    for (const socketId of orphanedSocketIds) {
        const binding = await redis.hgetall(`socket:${socketId}`);
        if (!binding.collaborationId || !binding.userId) {
            // Malformed key — just delete it
            pipeline.del(`socket:${socketId}`);
            continue;
        }

        const { collaborationId, userId } = binding;

        // Track for phase 2
        if (!affected.has(collaborationId)) {
            affected.set(collaborationId, new Set());
        }
        affected.get(collaborationId)!.add(userId);

        pipeline.srem(`presence:${collaborationId}:sockets`, socketId);
        pipeline.del(`socket:${socketId}`);
    }

    await pipeline.exec();

    // Phase 2: reconcile presence for each affected user
    const now = Date.now();
    const fixPipeline = redis.pipeline();

    for (const [collaborationId, userIds] of affected) {
        // After cleanup, count how many sockets remain (should be 0 in most cases)
        const remainingCount = await redis.scard(`presence:${collaborationId}:sockets`);

        for (const userId of userIds) {
            const presenceKey = `presence:${collaborationId}:${userId}`;
            const currentStatus = await redis.hget(presenceKey, "status");

            // Only fix users who still appear "connected" — don't touch "left" users
            if (currentStatus === "connected") {
                fixPipeline.hset(presenceKey, {
                    socketCount: String(remainingCount),
                    status: "disconnected",
                    lastDisconnectTime: String(now),
                });
            }
        }
    }

    await fixPipeline.exec();

    logger.info(
        { socketsRemoved: orphanedSocketIds.length, sessionsAffected: affected.size },
        "Orphaned socket presence reconciliation complete",
    );
}
