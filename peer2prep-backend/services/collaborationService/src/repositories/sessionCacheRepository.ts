import IORedis from "ioredis";

import { env } from "@/config/env.js";
import type { CollaborationSession } from "@/models/session.js";
import { logger } from "@/utils/logger.js";

type RedisMulti = {
    hset: (key: string, values: Record<string, string>) => RedisMulti;
    pexpire: (key: string, ttlMs: number) => RedisMulti;
    exec: () => Promise<unknown>;
};

export class SessionCacheRepository {
    private readonly redis: {
        connect: () => Promise<unknown>;
        multi: () => RedisMulti;
    };
    private connected = false;

    constructor() {
        const RedisConstructor = IORedis as unknown as new (options: {
            host: string;
            port: number;
            db: number;
            keyPrefix: string;
            lazyConnect: boolean;
            maxRetriesPerRequest: number;
            enableOfflineQueue: boolean;
        }) => SessionCacheRepository["redis"];

        this.redis = new RedisConstructor({
            host: env.redisHost,
            port: env.redisPort,
            db: env.redisDb,
            keyPrefix: env.redisKeyPrefix,
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
        });
    }

    async cacheActiveSession(session: CollaborationSession): Promise<boolean> {
        const key = `collab:session:${session.collaborationId}`;

        try {
            if (!this.connected) {
                await this.redis.connect();
                this.connected = true;
            }

            await this.redis.multi()
                .hset(key, {
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
                })
                .pexpire(key, env.sessionTtlMs)
                .exec();

            return true;
        } catch (error) {
            logger.warn(
                {
                    err: error,
                    collaborationId: session.collaborationId,
                },
                "Failed to cache collaboration session",
            );
            return false;
        }
    }
}
