import { randomUUID } from "node:crypto";

import { env } from "@/config/env.js";
import type { CollaborationSession, CreateSessionRequest, SessionStatus } from "@/models/session.js";
import { getRedisClient } from "@/utils/redis.js";

function buildPairKey(userAId: string, userBId: string): string {
    const [left, right] = [userAId, userBId].sort();
    return `${left}:${right}`;
}

function buildIdempotencyKey(payload: CreateSessionRequest): string {
    return [
        payload.matchId?.trim() || buildPairKey(payload.userAId, payload.userBId),
        payload.difficulty,
        payload.language.trim().toLowerCase(),
        payload.topic.trim().toLowerCase(),
    ].join(":");
}

type CreateSessionInput = CreateSessionRequest & {
    questionId: string;
};

type CreateSessionResult =
    | {
          session: CollaborationSession;
          created: true;
          idempotentHit: false;
          conflict: false;
      }
    | {
          session: CollaborationSession;
          created: false;
          idempotentHit: true;
          conflict: false;
      }
    | {
          session: CollaborationSession;
          created: false;
          idempotentHit: false;
          conflict: true;
      };

// Redis key patterns (prefix is added by the client)
const KEYS = {
    session: (id: string) => `session:${id}`,
    sessionByPair: (userA: string, userB: string) => `session:pair:${buildPairKey(userA, userB)}`,
    sessionByIdempotency: (key: string) => `session:idempotency:${key}`,
};

function parseSession(data: Record<string, string>): CollaborationSession | null {
    if (!data.collaborationId) {
        return null;
    }

    return {
        collaborationId: data.collaborationId,
        matchId: data.matchId || undefined,
        userAId: data.userAId,
        userBId: data.userBId,
        difficulty: data.difficulty as CollaborationSession["difficulty"],
        language: data.language,
        topic: data.topic,
        questionId: data.questionId,
        status: data.status as SessionStatus,
        createdAt: data.createdAt,
    };
}

export class RedisSessionRepository {
    private readonly redis = getRedisClient();
    private readonly ttlMs = env.sessionTtlMs;

    async createActiveSession(input: CreateSessionInput): Promise<CreateSessionResult> {
        const pairKey = buildPairKey(input.userAId, input.userBId);
        const idempotencyKey = buildIdempotencyKey(input);

        // Check idempotency key first
        const existingIdempotencyId = await this.redis.get(KEYS.sessionByIdempotency(idempotencyKey));
        if (existingIdempotencyId) {
            const existingSession = await this.getSessionByCollaborationId(existingIdempotencyId);
            if (existingSession && existingSession.status === "active") {
                return {
                    session: existingSession,
                    created: false,
                    idempotentHit: true,
                    conflict: false,
                };
            }
        }

        // Check if there's an active session for this pair
        const existingPairId = await this.redis.get(KEYS.sessionByPair(input.userAId, input.userBId));
        if (existingPairId) {
            const existingSession = await this.getSessionByCollaborationId(existingPairId);
            if (existingSession && existingSession.status === "active") {
                return {
                    session: existingSession,
                    created: false,
                    idempotentHit: false,
                    conflict: true,
                };
            }
        }

        // Create new session
        const session: CollaborationSession = {
            collaborationId: randomUUID(),
            matchId: input.matchId,
            userAId: input.userAId,
            userBId: input.userBId,
            difficulty: input.difficulty,
            language: input.language,
            topic: input.topic,
            questionId: input.questionId,
            status: "active",
            createdAt: new Date().toISOString(),
        };

        const sessionKey = KEYS.session(session.collaborationId);
        const pairKeyFull = KEYS.sessionByPair(input.userAId, input.userBId);
        const idempotencyKeyFull = KEYS.sessionByIdempotency(idempotencyKey);

        // Store session data atomically
        const pipeline = this.redis.pipeline();

        pipeline.hset(sessionKey, {
            collaborationId: session.collaborationId,
            matchId: session.matchId ?? "",
            userAId: session.userAId,
            userBId: session.userBId,
            difficulty: session.difficulty,
            language: session.language,
            topic: session.topic,
            questionId: session.questionId,
            status: session.status,
            createdAt: session.createdAt,
        });
        pipeline.pexpire(sessionKey, this.ttlMs);

        // Set pair lookup
        pipeline.set(pairKeyFull, session.collaborationId, "PX", this.ttlMs);

        // Set idempotency lookup
        pipeline.set(idempotencyKeyFull, session.collaborationId, "PX", this.ttlMs);

        await pipeline.exec();

        return {
            session,
            created: true,
            idempotentHit: false,
            conflict: false,
        };
    }

    async getSessionByCollaborationId(collaborationId: string): Promise<CollaborationSession | null> {
        const data = await this.redis.hgetall(KEYS.session(collaborationId));
        return parseSession(data);
    }

    async markSessionInactive(collaborationId: string): Promise<CollaborationSession | null> {
        const session = await this.getSessionByCollaborationId(collaborationId);
        if (!session) {
            return null;
        }

        // Update status
        await this.redis.hset(KEYS.session(collaborationId), "status", "inactive");
        session.status = "inactive";

        // Remove from active pair lookup
        await this.redis.del(KEYS.sessionByPair(session.userAId, session.userBId));

        return session;
    }

    async deleteSessionData(collaborationId: string): Promise<void> {
        const session = await this.getSessionByCollaborationId(collaborationId);
        if (!session) {
            return;
        }

        const pipeline = this.redis.pipeline();

        // Delete session hash
        pipeline.del(KEYS.session(collaborationId));

        // Delete pair lookup
        pipeline.del(KEYS.sessionByPair(session.userAId, session.userBId));

        await pipeline.exec();
    }

    async getActiveSessions(): Promise<CollaborationSession[]> {
        // Scan for all session keys
        const sessions: CollaborationSession[] = [];
        let cursor = "0";

        do {
            // Note: scan without prefix since keyPrefix is auto-added
            const [nextCursor, keys] = await this.redis.scan(
                cursor,
                "MATCH",
                "session:*",
                "COUNT",
                100,
            );
            cursor = nextCursor;

            // Filter for session hashes (not pair or idempotency keys)
            const sessionKeys = keys.filter(
                (key: string) => key.startsWith("session:") && !key.includes(":pair:") && !key.includes(":idempotency:"),
            );

            for (const key of sessionKeys) {
                // Get without prefix since keyPrefix is auto-added
                const keyWithoutPrefix = key.replace(env.redisKeyPrefix, "");
                const data = await this.redis.hgetall(keyWithoutPrefix);
                const session = parseSession(data);
                if (session && session.status === "active") {
                    sessions.push(session);
                }
            }
        } while (cursor !== "0");

        return sessions;
    }
}
