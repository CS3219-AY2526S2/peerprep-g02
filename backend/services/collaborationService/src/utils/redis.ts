import IORedis from "ioredis";

import { env } from "@/config/env.js";
import { logger } from "@/utils/logger.js";

// Type for the Redis client that covers all methods we use
type RedisClient = {
    ping: () => Promise<string>;
    quit: () => Promise<string>;
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, ...args: (string | number)[]) => Promise<string>;
    del: (...keys: string[]) => Promise<number>;
    exists: (...keys: string[]) => Promise<number>;
    hset: (key: string, ...fieldValues: (string | Record<string, string>)[]) => Promise<number>;
    hget: (key: string, field: string) => Promise<string | null>;
    hmget: (key: string, ...fields: string[]) => Promise<(string | null)[]>;
    hgetall: (key: string) => Promise<Record<string, string>>;
    hdel: (key: string, ...fields: string[]) => Promise<number>;
    pexpire: (key: string, ms: number) => Promise<number>;
    sadd: (key: string, ...members: string[]) => Promise<number>;
    srem: (key: string, ...members: string[]) => Promise<number>;
    smembers: (key: string) => Promise<string[]>;
    sismember: (key: string, member: string) => Promise<number>;
    scard: (key: string) => Promise<number>;
    incr: (key: string) => Promise<number>;
    lpush: (key: string, ...values: string[]) => Promise<number>;
    rpush: (key: string, ...values: string[]) => Promise<number>;
    lrange: (key: string, start: number, stop: number) => Promise<string[]>;
    ltrim: (key: string, start: number, stop: number) => Promise<string>;
    scan: (cursor: string, ...args: (string | number)[]) => Promise<[string, string[]]>;
    pipeline: () => RedisPipeline;
    on: (event: string, callback: (...args: unknown[]) => void) => void;
};

type RedisPipeline = {
    get: (key: string) => RedisPipeline;
    set: (key: string, value: string, ...args: (string | number)[]) => RedisPipeline;
    del: (...keys: string[]) => RedisPipeline;
    hset: (key: string, data: Record<string, string>) => RedisPipeline;
    hgetall: (key: string) => RedisPipeline;
    hdel: (key: string, ...fields: string[]) => RedisPipeline;
    pexpire: (key: string, ms: number) => RedisPipeline;
    sadd: (key: string, ...members: string[]) => RedisPipeline;
    srem: (key: string, ...members: string[]) => RedisPipeline;
    incr: (key: string) => RedisPipeline;
    lpush: (key: string, ...values: string[]) => RedisPipeline;
    rpush: (key: string, ...values: string[]) => RedisPipeline;
    ltrim: (key: string, start: number, stop: number) => RedisPipeline;
    exec: () => Promise<unknown[]>;
};

let redisClient: RedisClient | null = null;

export function getRedisClient(): RedisClient {
    if (!redisClient) {
        const RedisConstructor = IORedis as unknown as new (options: {
            host: string;
            port: number;
            db: number;
            keyPrefix: string;
            maxRetriesPerRequest: number;
            retryStrategy: (times: number) => number | null;
        }) => RedisClient;

        const client = new RedisConstructor({
            host: env.redisHost,
            port: env.redisPort,
            db: env.redisDb,
            keyPrefix: env.redisKeyPrefix,
            maxRetriesPerRequest: 3,
            retryStrategy: (times: number) => {
                if (times > 3) {
                    logger.error("Redis connection failed after 3 retries");
                    return null;
                }
                return Math.min(times * 100, 3000);
            },
        });

        client.on("error", (error: unknown) => {
            logger.error({ err: error }, "Redis client error");
        });

        client.on("connect", () => {
            logger.info("Redis client connected");
        });

        client.on("ready", () => {
            logger.info("Redis client ready");
        });

        redisClient = client;
    }

    return redisClient;
}

export async function closeRedis(): Promise<void> {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        logger.info("Redis connection closed");
    }
}
