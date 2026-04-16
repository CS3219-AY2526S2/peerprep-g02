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

    /**
     * Atomically reserve a hint slot via INCR, then store the hint.
     * If the incremented count exceeds the limit, rolls back with SET and returns null.
     */
    async tryAddHint(
        collaborationId: string,
        userId: string,
        hint: string,
    ): Promise<{ hints: StoredHint[]; hintsRemaining: number } | null> {
        const countKey = KEYS.hintCount(collaborationId, userId);

        // INCR is atomic — two concurrent calls get distinct values (e.g. 1 and 2)
        const newCount = await this.redis.incr(countKey);
        await this.redis.pexpire(countKey, this.ttlMs);

        if (newCount > this.maxHintsPerUser) {
            // Over the limit — cap the counter back to max and reject
            await this.redis.set(countKey, String(this.maxHintsPerUser), "PX", this.ttlMs);
            return null;
        }

        // Slot reserved — store the hint
        const entry: StoredHint = { userId, hint, timestamp: Date.now() };
        const hintsKey = KEYS.hints(collaborationId);
        const pipeline = this.redis.pipeline();
        pipeline.rpush(hintsKey, JSON.stringify(entry));
        pipeline.pexpire(hintsKey, this.ttlMs);
        await pipeline.exec();

        const hints = await this.getHints(collaborationId);
        const hintsRemaining = Math.max(0, this.maxHintsPerUser - newCount);
        return { hints, hintsRemaining };
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
