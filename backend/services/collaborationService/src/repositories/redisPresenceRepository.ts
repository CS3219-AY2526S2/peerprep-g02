import type { UUID } from "node:crypto";

import { env } from "@/config/env.js";
import type { PresenceStatus, SessionParticipantPresence } from "@/models/session.js";
import { getRedisClient } from "@/utils/redis.js";

type SocketBinding = {
    collaborationId: UUID;
    userId: UUID;
};

export type DisconnectInfo = {
    collaborationId: UUID;
    userId: UUID;
    disconnectedAt: number;
    durationMs: number;
};

// Redis key patterns
const KEYS = {
    presence: (collabId: string, userId: string) => `presence:${collabId}:${userId}`,
    sockets: (collabId: string) => `presence:${collabId}:sockets`,
    socket: (socketId: string) => `socket:${socketId}`,
    left: (collabId: string) => `left:${collabId}`,
    activity: (collabId: string) => `activity:${collabId}`,
};

export class RedisPresenceRepository {
    private readonly redis = getRedisClient();
    private readonly ttlMs = env.sessionTtlMs;

    async addSocketConnection(
        collaborationId: string,
        userId: string,
        socketId: string,
    ): Promise<{
        isFirstConnection: boolean;
        wasDisconnected: boolean;
        disconnectDurationMs: number;
    }> {
        const now = Date.now();
        const presenceKey = KEYS.presence(collaborationId, userId);

        // Get current state
        const currentState = await this.redis.hgetall(presenceKey);
        const wasDisconnected = currentState.status === "disconnected";
        const currentSocketCount = parseInt(currentState.socketCount ?? "0", 10);
        const isFirstConnection = currentSocketCount === 0;

        // Calculate disconnect duration
        let disconnectDurationMs = 0;
        if (wasDisconnected && currentState.lastDisconnectTime) {
            disconnectDurationMs = now - parseInt(currentState.lastDisconnectTime, 10);
        }

        const pipeline = this.redis.pipeline();

        // Update presence state
        pipeline.hset(presenceKey, {
            userId,
            status: "connected",
            socketCount: (currentSocketCount + 1).toString(),
            lastActivityTime: now.toString(),
        });
        pipeline.hdel(presenceKey, "lastDisconnectTime");
        pipeline.pexpire(presenceKey, this.ttlMs);

        // Add socket to session's socket set
        pipeline.sadd(KEYS.sockets(collaborationId), socketId);
        pipeline.pexpire(KEYS.sockets(collaborationId), this.ttlMs);

        // Store socket binding
        pipeline.hset(KEYS.socket(socketId), {
            collaborationId,
            userId,
        });
        pipeline.pexpire(KEYS.socket(socketId), this.ttlMs);

        // Remove from left set if rejoining
        pipeline.srem(KEYS.left(collaborationId), userId);

        // Update session activity
        pipeline.set(KEYS.activity(collaborationId), now.toString(), "PX", this.ttlMs);

        await pipeline.exec();

        return { isFirstConnection, wasDisconnected, disconnectDurationMs };
    }

    async removeSocketConnection(socketId: string): Promise<{
        binding: SocketBinding;
        isLastConnection: boolean;
        status: PresenceStatus;
    } | null> {
        // Get socket binding
        const rawBinding = await this.redis.hgetall(KEYS.socket(socketId));
        if (!rawBinding.collaborationId || !rawBinding.userId) {
            return null;
        }

        const collaborationId = rawBinding.collaborationId as UUID;
        const userId = rawBinding.userId as UUID;
        const presenceKey = KEYS.presence(collaborationId, userId);

        // Get current socket count
        const currentState = await this.redis.hgetall(presenceKey);
        const currentSocketCount = parseInt(currentState.socketCount ?? "0", 10);
        const newSocketCount = Math.max(0, currentSocketCount - 1);
        const isLastConnection = newSocketCount === 0;

        const pipeline = this.redis.pipeline();

        // Update socket count
        pipeline.hset(presenceKey, { socketCount: newSocketCount.toString() });

        if (isLastConnection) {
            const now = Date.now();
            pipeline.hset(presenceKey, {
                status: "disconnected",
                lastDisconnectTime: now.toString(),
            });
        }

        // Remove socket from session's socket set
        pipeline.srem(KEYS.sockets(collaborationId), socketId);

        // Delete socket binding
        pipeline.del(KEYS.socket(socketId));

        await pipeline.exec();

        // Get updated status
        const updatedState = await this.redis.hget(presenceKey, "status");
        const status = (updatedState as PresenceStatus) ?? "disconnected";

        return {
            binding: { collaborationId, userId },
            isLastConnection,
            status,
        };
    }

    async markUserAsLeft(collaborationId: string, userId: string): Promise<void> {
        const presenceKey = KEYS.presence(collaborationId, userId);

        const pipeline = this.redis.pipeline();

        pipeline.hset(presenceKey, { status: "left" });
        pipeline.sadd(KEYS.left(collaborationId), userId);
        pipeline.pexpire(KEYS.left(collaborationId), this.ttlMs);

        await pipeline.exec();
    }

    async hasUserLeft(collaborationId: string, userId: string): Promise<boolean> {
        const result = await this.redis.sismember(KEYS.left(collaborationId), userId);
        return result === 1;
    }

    async getDistinctUserIds(collaborationId: string): Promise<Set<string>> {
        // Get all sockets in this session
        const socketIds = await this.redis.smembers(KEYS.sockets(collaborationId));

        const connectedUsers = new Set<string>();
        for (const socketId of socketIds) {
            const binding = await this.redis.hgetall(KEYS.socket(socketId));
            if (binding.userId) {
                // Check if user is connected
                const presenceKey = KEYS.presence(collaborationId, binding.userId);
                const status = await this.redis.hget(presenceKey, "status");
                if (status === "connected") {
                    connectedUsers.add(binding.userId);
                }
            }
        }

        return connectedUsers;
    }

    async getUserPresenceStatus(collaborationId: string, userId: string): Promise<PresenceStatus> {
        const presenceKey = KEYS.presence(collaborationId, userId);
        const status = await this.redis.hget(presenceKey, "status");
        return (status as PresenceStatus) ?? "disconnected";
    }

    async getParticipants(
        collaborationId: string,
        assignedUserIds: UUID[],
    ): Promise<SessionParticipantPresence[]> {
        const results: SessionParticipantPresence[] = [];

        for (const userId of assignedUserIds) {
            const presenceKey = KEYS.presence(collaborationId, userId);
            const state = await this.redis.hgetall(presenceKey);

            const socketCount = parseInt(state.socketCount ?? "0", 10);
            const status = (state.status as PresenceStatus) ?? "disconnected";

            results.push({
                userId,
                status,
                connectionCount: socketCount,
            });
        }

        return results;
    }

    async getSocketBinding(socketId: string): Promise<SocketBinding | undefined> {
        const binding = await this.redis.hgetall(KEYS.socket(socketId));
        if (!binding.collaborationId || !binding.userId) {
            return undefined;
        }
        return {
            collaborationId: binding.collaborationId as UUID,
            userId: binding.userId as UUID,
        };
    }

    /**
     * Get all socket IDs for a specific user in a collaboration session
     */
    async getUserSocketIds(collaborationId: string, userId: string): Promise<string[]> {
        const socketIds = await this.redis.smembers(KEYS.sockets(collaborationId));
        const userSocketIds: string[] = [];

        for (const socketId of socketIds) {
            const binding = await this.redis.hgetall(KEYS.socket(socketId));
            if (binding.userId === userId) {
                userSocketIds.push(socketId);
            }
        }

        return userSocketIds;
    }

    /**
     * Remove all socket connections for a user in a collaboration session
     */
    async removeAllUserSocketConnections(
        collaborationId: string,
        userId: string,
    ): Promise<string[]> {
        const socketIds = await this.getUserSocketIds(collaborationId, userId);

        if (socketIds.length === 0) {
            return [];
        }

        const presenceKey = KEYS.presence(collaborationId, userId);
        const pipeline = this.redis.pipeline();

        // Remove all sockets from session's socket set
        for (const socketId of socketIds) {
            pipeline.srem(KEYS.sockets(collaborationId), socketId);
            pipeline.del(KEYS.socket(socketId));
        }

        // Update presence to show no connections
        pipeline.hset(presenceKey, {
            socketCount: "0",
            status: "left",
            lastDisconnectTime: Date.now().toString(),
        });

        await pipeline.exec();

        return socketIds;
    }

    async getDisconnectDuration(collaborationId: string, userId: string): Promise<number | null> {
        const presenceKey = KEYS.presence(collaborationId, userId);
        const state = await this.redis.hgetall(presenceKey);

        if (state.status !== "disconnected" || !state.lastDisconnectTime) {
            return null;
        }

        return Date.now() - parseInt(state.lastDisconnectTime, 10);
    }

    async getDisconnectedUsers(collaborationId: string): Promise<DisconnectInfo[]> {
        const socketIds = await this.redis.smembers(KEYS.sockets(collaborationId));
        const userIds = new Set<UUID>();

        // Collect all user IDs from sockets
        for (const socketId of socketIds) {
            const binding = await this.redis.hgetall(KEYS.socket(socketId));
            if (binding.userId) {
                userIds.add(binding.userId as UUID);
            }
        }

        const now = Date.now();
        const disconnected: DisconnectInfo[] = [];

        for (const userId of userIds) {
            const presenceKey = KEYS.presence(collaborationId, userId);
            const state = await this.redis.hgetall(presenceKey);

            if (state.status === "disconnected" && state.lastDisconnectTime) {
                const disconnectedAt = parseInt(state.lastDisconnectTime, 10);
                disconnected.push({
                    collaborationId: collaborationId as UUID,
                    userId,
                    disconnectedAt,
                    durationMs: now - disconnectedAt,
                });
            }
        }

        return disconnected;
    }

    async updateActivityTime(collaborationId: string, userId: string): Promise<void> {
        const presenceKey = KEYS.presence(collaborationId, userId);
        await this.redis.hset(presenceKey, "lastActivityTime", Date.now().toString());
    }

    async hasUserTimedOut(
        collaborationId: string,
        userId: string,
        timeoutMs: number,
    ): Promise<boolean> {
        const presenceKey = KEYS.presence(collaborationId, userId);
        const state = await this.redis.hgetall(presenceKey);

        if (state.status !== "connected" || !state.lastActivityTime) {
            return false;
        }

        return Date.now() - parseInt(state.lastActivityTime, 10) > timeoutMs;
    }

    async haveBothUsersLeft(collaborationId: string, assignedUserIds: string[]): Promise<boolean> {
        for (const userId of assignedUserIds) {
            const hasLeft = await this.redis.sismember(KEYS.left(collaborationId), userId);
            if (hasLeft !== 1) {
                return false;
            }
        }
        return true;
    }

    async getSessionLastActivity(collaborationId: string): Promise<number | null> {
        const activity = await this.redis.get(KEYS.activity(collaborationId));
        return activity ? parseInt(activity, 10) : null;
    }

    async updateSessionActivity(collaborationId: string): Promise<void> {
        await this.redis.set(
            KEYS.activity(collaborationId),
            Date.now().toString(),
            "PX",
            this.ttlMs,
        );
    }

    async isSessionInactive(
        collaborationId: string,
        inactivityTimeoutMs: number,
    ): Promise<boolean> {
        const lastActivity = await this.getSessionLastActivity(collaborationId);
        if (!lastActivity) {
            return false;
        }
        return Date.now() - lastActivity > inactivityTimeoutMs;
    }

    async canRejoinWithinGracePeriod(
        collaborationId: string,
        userId: string,
        gracePeriodMs: number,
    ): Promise<{ canRejoin: boolean; disconnectDurationMs: number; gracePeriodMs: number }> {
        const presenceKey = KEYS.presence(collaborationId, userId);
        const state = await this.redis.hgetall(presenceKey);

        // No presence data — either first join or data expired.
        // Check if the session sockets set exists to distinguish the two cases.
        if (!state.status) {
            const socketCount = await this.redis.scard(KEYS.sockets(collaborationId));
            if (socketCount === 0) {
                // Presence data expired — do not allow rejoin
                return { canRejoin: false, disconnectDurationMs: -1, gracePeriodMs };
            }
            // Session is live, user is joining for the first time
            return { canRejoin: true, disconnectDurationMs: 0, gracePeriodMs };
        }

        // Already connected
        if (state.status === "connected") {
            return { canRejoin: true, disconnectDurationMs: 0, gracePeriodMs };
        }

        // User left intentionally
        if (state.status === "left") {
            return { canRejoin: false, disconnectDurationMs: -1, gracePeriodMs };
        }

        // User is disconnected - check grace period
        if (!state.lastDisconnectTime) {
            return { canRejoin: true, disconnectDurationMs: 0, gracePeriodMs };
        }

        const disconnectDurationMs = Date.now() - parseInt(state.lastDisconnectTime, 10);
        const canRejoin = disconnectDurationMs <= gracePeriodMs;

        return { canRejoin, disconnectDurationMs, gracePeriodMs };
    }

    async cleanupSession(collaborationId: string, assignedUserIds?: string[]): Promise<void> {
        // Get all sockets for this session (may already be empty if users left)
        const socketIds = await this.redis.smembers(KEYS.sockets(collaborationId));

        const pipeline = this.redis.pipeline();

        // Delete all socket bindings
        for (const socketId of socketIds) {
            pipeline.del(KEYS.socket(socketId));
        }

        // Delete session sockets set
        pipeline.del(KEYS.sockets(collaborationId));

        // Delete left users set
        pipeline.del(KEYS.left(collaborationId));

        // Delete activity timestamp
        pipeline.del(KEYS.activity(collaborationId));

        // Delete presence keys for assigned users directly
        // (don't rely on sockets set — it may already be empty after leaveSession)
        if (assignedUserIds && assignedUserIds.length > 0) {
            for (const userId of assignedUserIds) {
                pipeline.del(KEYS.presence(collaborationId, userId));
            }
        } else {
            // Fallback: try to find user IDs from remaining sockets
            for (const socketId of socketIds) {
                const binding = await this.redis.hgetall(KEYS.socket(socketId));
                if (binding.userId) {
                    pipeline.del(KEYS.presence(collaborationId, binding.userId));
                }
            }
        }

        await pipeline.exec();
    }
}
