import { Redis } from "ioredis";

import { CollaborationSession } from "@/models/models.js";

export class SessionCache {
    constructor(
        private readonly redisClient: Redis,
        private readonly ttlMs: number,
    ) {}

    async set(session: CollaborationSession): Promise<void> {
        await this.redisClient.set(
            session.sessionId,
            JSON.stringify(session),
            "PX",
            this.ttlMs,
        );
    }

    async get(sessionId: string): Promise<CollaborationSession | null> {
        const rawSession = await this.redisClient.get(sessionId);
        if (!rawSession) {
            return null;
        }

        return JSON.parse(rawSession) as CollaborationSession;
    }

    async delete(sessionId: string): Promise<void> {
        await this.redisClient.del(sessionId);
    }
}
