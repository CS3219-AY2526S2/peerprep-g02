import { type RedisClientType, createClient } from "redis";

import { redisLogger } from "@/utils/logger.js";

class RedisManager {
    private static instance: RedisClientType;

    public static getInstance(): RedisClientType {
        if (!this.instance) {
            const redisUrl = process.env.MS_REDIS_URL;
            if (!redisUrl) throw new Error(`Redis URL is undefined`);

            this.instance = createClient({ url: redisUrl });

            this.instance.on("error", (err) => redisLogger.error(err, "Redis Client Error"));
            this.instance.on("reconnecting", () => redisLogger.warn("Redis reconnecting..."));
            this.instance.on("ready", () => redisLogger.info("Redis ready to receive commands"));
        }
        return this.instance;
    }

    public static async connect(): Promise<void> {
        const client = this.getInstance();
        if (!client.isOpen) {
            await client.connect();
        }
    }

    public static async disconnect(): Promise<void> {
        if (this.instance?.isOpen) {
            await this.instance.quit();
            redisLogger.info("Redis connection closed gracefully");
        }
    }
}

export default RedisManager;
