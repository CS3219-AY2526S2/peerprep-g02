import { env } from "@/config/env.js";
import { getRedisClient } from "@/utils/redis.js";

// Redis key pattern
const KEYS = {
    output: (collabId: string) => `output:${collabId}`,
};

export class RedisOutputRepository {
    private readonly redis = getRedisClient();
    private readonly ttlMs = env.sessionTtlMs;

    async setOutput(collaborationId: string, output: string): Promise<void> {
        await this.redis.set(KEYS.output(collaborationId), output, "PX", this.ttlMs);
    }

    async getOutput(collaborationId: string): Promise<string> {
        const output = await this.redis.get(KEYS.output(collaborationId));
        return output ?? "";
    }

    async deleteOutput(collaborationId: string): Promise<void> {
        await this.redis.del(KEYS.output(collaborationId));
    }
}
