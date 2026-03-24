import { env } from "@/config/env.js";
import type { OTOperation } from "@/models/session.js";
import { logger } from "@/utils/logger.js";
import { getRedisClient } from "@/utils/redis.js";

// Redis key patterns
const KEYS = {
    content: (id: string) => `ot:${id}:content`,
    revision: (id: string) => `ot:${id}:revision`,
    ops: (id: string) => `ot:${id}:ops`,
};

// Max operations to keep for transformation history
const MAX_OPS_HISTORY = 50;

/**
 * Lua script for atomic compare-and-swap update.
 * Returns 1 if update succeeded (revision matched), 0 if revision changed.
 */
const UPDATE_IF_REVISION_MATCHES_SCRIPT = `
local contentKey = KEYS[1]
local revisionKey = KEYS[2]
local opsKey = KEYS[3]
local expectedRevision = tonumber(ARGV[1])
local newContent = ARGV[2]
local newRevision = ARGV[3]
local operationJson = ARGV[4]
local ttlMs = tonumber(ARGV[5])
local maxOpsHistory = tonumber(ARGV[6])

local currentRevision = tonumber(redis.call('GET', revisionKey) or '0')

if currentRevision ~= expectedRevision then
    return 0
end

redis.call('SET', contentKey, newContent, 'PX', ttlMs)
redis.call('SET', revisionKey, newRevision, 'PX', ttlMs)
redis.call('LPUSH', opsKey, operationJson)
redis.call('LTRIM', opsKey, 0, maxOpsHistory - 1)
redis.call('PEXPIRE', opsKey, ttlMs)

return 1
`;

type StoredOperation = {
    userId: string;
    revision: number;
    clientOps: OTOperation[];
    serverOps: OTOperation[];
};

export type OTDocumentState = {
    content: string;
    revision: number;
};

export class RedisOTRepository {
    private readonly redis = getRedisClient();
    private readonly ttlMs = env.sessionTtlMs;

    async initializeDocument(collaborationId: string, content: string = ""): Promise<void> {
        const pipeline = this.redis.pipeline();

        pipeline.set(KEYS.content(collaborationId), content, "PX", this.ttlMs);
        pipeline.set(KEYS.revision(collaborationId), "0", "PX", this.ttlMs);

        await pipeline.exec();
    }

    async getDocument(collaborationId: string): Promise<OTDocumentState | null> {
        const [content, revisionStr] = await Promise.all([
            this.redis.get(KEYS.content(collaborationId)),
            this.redis.get(KEYS.revision(collaborationId)),
        ]);

        if (content === null || revisionStr === null) {
            return null;
        }

        return {
            content,
            revision: parseInt(revisionStr, 10) || 0,
        };
    }

    async getContent(collaborationId: string): Promise<string> {
        const content = await this.redis.get(KEYS.content(collaborationId));
        return content ?? "";
    }

    async getRevision(collaborationId: string): Promise<number> {
        const revisionStr = await this.redis.get(KEYS.revision(collaborationId));
        return parseInt(revisionStr ?? "0", 10);
    }

    /**
     * Atomically update document if the current revision matches expected.
     * Returns true if update succeeded, false if revision changed (retry needed).
     */
    async updateDocumentIfRevisionMatches(
        collaborationId: string,
        expectedRevision: number,
        content: string,
        newRevision: number,
        operation: StoredOperation,
    ): Promise<boolean> {
        const result = await (this.redis as any).eval(
            UPDATE_IF_REVISION_MATCHES_SCRIPT,
            3,
            KEYS.content(collaborationId),
            KEYS.revision(collaborationId),
            KEYS.ops(collaborationId),
            expectedRevision.toString(),
            content,
            newRevision.toString(),
            JSON.stringify(operation),
            this.ttlMs.toString(),
            MAX_OPS_HISTORY.toString(),
        );

        return result === 1;
    }

    /**
     * @deprecated Use updateDocumentIfRevisionMatches for atomic updates
     */
    async updateDocument(
        collaborationId: string,
        content: string,
        newRevision: number,
        operation: StoredOperation,
    ): Promise<void> {
        const pipeline = this.redis.pipeline();

        // Update content and revision
        pipeline.set(KEYS.content(collaborationId), content, "PX", this.ttlMs);
        pipeline.set(KEYS.revision(collaborationId), newRevision.toString(), "PX", this.ttlMs);

        // Push operation to history (LPUSH for newest first)
        pipeline.lpush(KEYS.ops(collaborationId), JSON.stringify(operation));
        // Trim to keep only recent operations
        pipeline.ltrim(KEYS.ops(collaborationId), 0, MAX_OPS_HISTORY - 1);
        // Refresh TTL
        pipeline.pexpire(KEYS.ops(collaborationId), this.ttlMs);

        await pipeline.exec();
    }

    async getOperationsSinceRevision(
        collaborationId: string,
        sinceRevision: number,
    ): Promise<StoredOperation[]> {
        // Get all stored operations (newest first due to LPUSH)
        const opsJson = await this.redis.lrange(KEYS.ops(collaborationId), 0, -1);

        const operations: StoredOperation[] = [];
        for (const json of opsJson) {
            try {
                const op = JSON.parse(json) as StoredOperation;
                if (op.revision > sinceRevision) {
                    operations.push(op);
                }
            } catch (error) {
                logger.warn({ error, json }, "Failed to parse stored operation");
            }
        }

        // Return in ascending revision order
        return operations.sort((a, b) => a.revision - b.revision);
    }

    async deleteDocument(collaborationId: string): Promise<void> {
        const pipeline = this.redis.pipeline();

        pipeline.del(KEYS.content(collaborationId));
        pipeline.del(KEYS.revision(collaborationId));
        pipeline.del(KEYS.ops(collaborationId));

        await pipeline.exec();
    }

    async refreshTTL(collaborationId: string): Promise<void> {
        const pipeline = this.redis.pipeline();

        pipeline.pexpire(KEYS.content(collaborationId), this.ttlMs);
        pipeline.pexpire(KEYS.revision(collaborationId), this.ttlMs);
        pipeline.pexpire(KEYS.ops(collaborationId), this.ttlMs);

        await pipeline.exec();
    }
}
