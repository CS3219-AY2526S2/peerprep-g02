import { type UUID, randomUUID } from "node:crypto";

import { env } from "@/config/env.js";
import type {
    CollaborationSession,
    CreateSessionRequest,
    SessionStatus,
} from "@/models/session.js";
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
    questionId: UUID;
    functionName?: string;
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
    userActiveSession: (userId: string) => `user:active-session:${userId}`,
};

function parseSession(data: Record<string, string>): CollaborationSession | null {
    if (!data.collaborationId) {
        return null;
    }

    return {
        collaborationId: data.collaborationId as UUID,
        matchId: data.matchId ? (data.matchId as UUID) : undefined,
        userAId: data.userAId as UUID,
        userBId: data.userBId as UUID,
        difficulty: data.difficulty as CollaborationSession["difficulty"],
        language: data.language,
        topic: data.topic,
        questionId: data.questionId as UUID,
        status: data.status as SessionStatus,
        createdAt: data.createdAt,
    };
}

export class RedisSessionRepository {
    private readonly redis = getRedisClient();
    private readonly ttlMs = env.sessionTtlMs;

    async createActiveSession(input: CreateSessionInput): Promise<CreateSessionResult> {
        const idempotencyKey = buildIdempotencyKey(input);

        // Check idempotency key first
        const existingIdempotencyId = await this.redis.get(
            KEYS.sessionByIdempotency(idempotencyKey),
        );
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
        const existingPairId = await this.redis.get(
            KEYS.sessionByPair(input.userAId, input.userBId),
        );
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
            ...(input.functionName ? { functionName: input.functionName } : {}),
        });
        pipeline.pexpire(sessionKey, this.ttlMs);

        // Set pair lookup
        pipeline.set(pairKeyFull, session.collaborationId, "PX", this.ttlMs);

        // Set idempotency lookup
        pipeline.set(idempotencyKeyFull, session.collaborationId, "PX", this.ttlMs);

        // Set user → active session index for both users
        pipeline.set(KEYS.userActiveSession(session.userAId), session.collaborationId, "PX", this.ttlMs);
        pipeline.set(KEYS.userActiveSession(session.userBId), session.collaborationId, "PX", this.ttlMs);

        await pipeline.exec();

        return {
            session,
            created: true,
            idempotentHit: false,
            conflict: false,
        };
    }

    async getSessionByCollaborationId(
        collaborationId: string,
    ): Promise<CollaborationSession | null> {
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

        // Remove user → active session index
        await this.redis.del(KEYS.userActiveSession(session.userAId));
        await this.redis.del(KEYS.userActiveSession(session.userBId));

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

        // Delete user → active session index
        pipeline.del(KEYS.userActiveSession(session.userAId));
        pipeline.del(KEYS.userActiveSession(session.userBId));

        await pipeline.exec();
    }

    async storeQuestionDetails(
        collaborationId: string,
        details: { questionTitle: string; questionDescription: string; testCases: string; functionName: string },
    ): Promise<void> {
        const sessionKey = KEYS.session(collaborationId);
        await this.redis.hset(sessionKey, {
            questionTitle: details.questionTitle,
            questionDescription: details.questionDescription,
            testCases: details.testCases,
            functionName: details.functionName,
        });
    }

    async getQuestionDetails(
        collaborationId: string,
    ): Promise<{ questionTitle: string; questionDescription: string; testCases: string; functionName: string } | null> {
        const sessionKey = KEYS.session(collaborationId);
        const [questionTitle, questionDescription, testCases, functionName] = await this.redis.hmget(
            sessionKey,
            "questionTitle",
            "questionDescription",
            "testCases",
            "functionName",
        );
        if (!questionTitle && !testCases && !functionName) {
            return null;
        }
        return {
            questionTitle: questionTitle ?? "",
            questionDescription: questionDescription ?? "",
            testCases: testCases ?? "[]",
            functionName: functionName ?? "",
        };
    }

    async getActiveSessionForUser(userId: string): Promise<CollaborationSession | null> {
        const collaborationId = await this.redis.get(KEYS.userActiveSession(userId));
        if (!collaborationId) {
            return null;
        }

        const session = await this.getSessionByCollaborationId(collaborationId);
        if (!session || session.status !== "active") {
            // Stale index — clean up
            await this.redis.del(KEYS.userActiveSession(userId));
            return null;
        }

        return session;
    }

    async clearUserActiveSession(userId: string): Promise<void> {
        await this.redis.del(KEYS.userActiveSession(userId));
    }

    async getActiveSessions(): Promise<CollaborationSession[]> {
        // Scan for all session keys
        const sessions: CollaborationSession[] = [];
        let cursor = "0";
        const prefix = env.redisKeyPrefix;

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

            // Strip prefix first (SCAN returns keys WITH the prefix), then filter
            const strippedKeys = keys.map((key: string) =>
                key.startsWith(prefix) ? key.slice(prefix.length) : key,
            );

            // Filter for session hashes (not pair or idempotency keys)
            const sessionKeys = strippedKeys.filter(
                (key: string) =>
                    key.startsWith("session:") &&
                    !key.includes(":pair:") &&
                    !key.includes(":idempotency:"),
            );

            for (const key of sessionKeys) {
                const data = await this.redis.hgetall(key);
                const session = parseSession(data);
                if (session && session.status === "active") {
                    sessions.push(session);
                }
            }
        } while (cursor !== "0");

        return sessions;
    }
}
