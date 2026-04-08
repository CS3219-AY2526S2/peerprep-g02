import { DEFAULTS } from "@/config/constants.js";
import { env } from "@/config/env.js";
import { getRedisClient } from "@/utils/redis.js";

export type StoredHint = {
    userId: string;
    hint: string;
    timestamp: number;
};

const KEYS = {
    hints: (collabId: string) => `hints:${collabId}`,
    hintCount: (collabId: string, userId: string) => `hints:count:${collabId}:${userId}`,
};

export class RedisHintRepository {
    private readonly redis = getRedisClient();
    private readonly ttlMs = env.sessionTtlMs;
    private readonly maxHintsPerUser = DEFAULTS.MAX_HINTS_PER_USER;

    async getHints(collaborationId: string): Promise<StoredHint[]> {
        const raw = await this.redis.lrange(KEYS.hints(collaborationId), 0, -1);
        return raw.map((entry) => JSON.parse(entry) as StoredHint);
    }

    async getHintCount(collaborationId: string, userId: string): Promise<number> {
        const count = await this.redis.get(KEYS.hintCount(collaborationId, userId));
        return count ? parseInt(count, 10) : 0;
    }

    async getHintsRemaining(collaborationId: string, userId: string): Promise<number> {
        const used = await this.getHintCount(collaborationId, userId);
        return Math.max(0, this.maxHintsPerUser - used);
    }

    async addHint(collaborationId: string, userId: string, hint: string): Promise<StoredHint[]> {
        const entry: StoredHint = { userId, hint, timestamp: Date.now() };
        const pipeline = this.redis.pipeline();

        const hintsKey = KEYS.hints(collaborationId);
        const countKey = KEYS.hintCount(collaborationId, userId);

        // Append hint to the list
        pipeline.rpush(hintsKey, JSON.stringify(entry));
        pipeline.pexpire(hintsKey, this.ttlMs);

        // Increment per-user count
        pipeline.incr(countKey);
        pipeline.pexpire(countKey, this.ttlMs);

        await pipeline.exec();

        return this.getHints(collaborationId);
    }

    async deleteHints(collaborationId: string, userIds: string[]): Promise<void> {
        const keys = [
            KEYS.hints(collaborationId),
            ...userIds.map((uid) => KEYS.hintCount(collaborationId, uid)),
        ];
        if (keys.length > 0) {
            await this.redis.del(...keys);
        }
    }
}
