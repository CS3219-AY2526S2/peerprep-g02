import { env } from "@/config/env.js";
import { logger } from "@/utils/logger.js";
import { getRedisClient } from "@/utils/redis.js";

/**
 * On startup, clean up socket bindings that belong to dead instances.
 *
 * Each running instance refreshes a liveness key (`instance:{id}`) in Redis
 * with a short TTL. Socket bindings (`socket:{id}`) include an `instanceId`
 * field identifying which instance owns them.
 *
 * This function SCANs all `socket:*` keys and only removes those whose owning
 * instance is no longer alive (liveness key missing/expired). Sockets belonging
 * to live instances are left untouched, making this safe for rolling restarts
 * and horizontally-scaled deployments.
 *
 */
export async function reconcileOrphanedSockets(): Promise<void> {
    const redis = getRedisClient();
    const prefix = env.redisKeyPrefix;

    // Phase 0: Collect all socket keys via cursor-based SCAN.
    // Use unprefixed pattern — ioredis auto-prepends keyPrefix to SCAN MATCH.
    // Returned keys include the prefix and must be stripped.
    const allSocketIds: string[] = [];
    let cursor = "0";

    do {
        const [nextCursor, keys] = await redis.scan(
            cursor,
            "MATCH",
            "socket:*",
            "COUNT",
            100,
        );
        cursor = nextCursor;

        for (const rawKey of keys) {
            const key = rawKey.startsWith(prefix) ? rawKey.slice(prefix.length) : rawKey;
            if (key.startsWith("socket:")) {
                allSocketIds.push(key.slice("socket:".length));
            }
        }
    } while (cursor !== "0");

    if (allSocketIds.length === 0) {
        return;
    }

    // Phase 0.5: Batch-read instanceId from all socket bindings via pipeline
    const readPipeline = redis.pipeline();
    for (const socketId of allSocketIds) {
        readPipeline.hgetall(`socket:${socketId}`);
    }
    const bindingResults = await readPipeline.exec();

    // Group sockets by owning instanceId
    const byInstance = new Map<string, string[]>();
    const bindingMap = new Map<string, Record<string, string>>();

    for (let i = 0; i < allSocketIds.length; i++) {
        const result = bindingResults[i] as [Error | null, Record<string, string>];
        const binding = result?.[1];
        if (!binding || typeof binding !== "object") continue;

        const socketId = allSocketIds[i];
        bindingMap.set(socketId, binding);

        const ownerInstanceId = binding.instanceId;
        if (!ownerInstanceId) continue; // Malformed binding — skip

        if (!byInstance.has(ownerInstanceId)) {
            byInstance.set(ownerInstanceId, []);
        }
        byInstance.get(ownerInstanceId)!.push(socketId);
    }

    // Check liveness for each unique instanceId, collect orphaned sockets
    const orphanedSocketIds: string[] = [];

    for (const [ownerInstanceId, socketIds] of byInstance) {
        const alive = await redis.exists(`instance:${ownerInstanceId}`);
        if (alive === 0) {
            orphanedSocketIds.push(...socketIds);
        }
    }

    if (orphanedSocketIds.length === 0) {
        return;
    }

    logger.info(
        { orphanedCount: orphanedSocketIds.length, totalScanned: allSocketIds.length },
        "Cleaning up orphaned socket bindings (dead instances only)",
    );

    // Phase 1: Delete socket keys and remove from session socket sets.
    // Track affected (collabId, userId) pairs for presence fixup.
    const affected = new Map<string, Set<string>>(); // collabId -> Set<userId>
    const deletePipeline = redis.pipeline();

    for (const socketId of orphanedSocketIds) {
        const binding = bindingMap.get(socketId);
        if (!binding?.collaborationId || !binding?.userId) {
            deletePipeline.del(`socket:${socketId}`);
            continue;
        }

        const { collaborationId, userId } = binding;

        if (!affected.has(collaborationId)) {
            affected.set(collaborationId, new Set());
        }
        affected.get(collaborationId)!.add(userId);

        deletePipeline.srem(`presence:${collaborationId}:sockets`, socketId);
        deletePipeline.del(`socket:${socketId}`);
    }

    await deletePipeline.exec();

    // Phase 2: Reconcile presence for each affected user.
    // Compute remaining socket count per-user (not per-session) by checking
    // which sockets in the session's socket set still belong to each user.
    const now = Date.now();
    const fixPipeline = redis.pipeline();

    for (const [collaborationId, userIds] of affected) {
        const remainingSockets = await redis.smembers(`presence:${collaborationId}:sockets`);

        // Count remaining sockets per user by reading their bindings
        const perUserCount = new Map<string, number>();
        for (const uid of userIds) {
            perUserCount.set(uid, 0);
        }

        if (remainingSockets.length > 0) {
            const countPipeline = redis.pipeline();
            for (const sid of remainingSockets) {
                countPipeline.hgetall(`socket:${sid}`);
            }
            const countResults = await countPipeline.exec();

            for (let i = 0; i < remainingSockets.length; i++) {
                const res = countResults[i] as [Error | null, Record<string, string>];
                const b = res?.[1];
                if (b?.userId && perUserCount.has(b.userId)) {
                    perUserCount.set(b.userId, perUserCount.get(b.userId)! + 1);
                }
            }
        }

        const statusPipeline = redis.pipeline();
        for (const userId of userIds) {
            statusPipeline.hget(`presence:${collaborationId}:${userId}`, "status");
        }
        const statusResults = await statusPipeline.exec();

        const userIdArray = [...userIds];
        for (let i = 0; i < userIdArray.length; i++) {
            const userId = userIdArray[i];
            const presenceKey = `presence:${collaborationId}:${userId}`;
            const currentStatus = (statusResults[i] as [Error | null, string | null])?.[1];

            // Only fix users who still appear "connected" — don't touch "left" users
            if (currentStatus === "connected") {
                const userSocketCount = perUserCount.get(userId) ?? 0;

                if (userSocketCount === 0) {
                    fixPipeline.hset(presenceKey, {
                        socketCount: "0",
                        status: "disconnected",
                        lastDisconnectTime: String(now),
                    });
                } else {
                    // User still has live sockets from another instance
                    fixPipeline.hset(presenceKey, {
                        socketCount: String(userSocketCount),
                    });
                }
            }
        }
    }

    await fixPipeline.exec();

    logger.info(
        { socketsRemoved: orphanedSocketIds.length, sessionsAffected: affected.size },
        "Orphaned socket presence reconciliation complete",
    );
}
