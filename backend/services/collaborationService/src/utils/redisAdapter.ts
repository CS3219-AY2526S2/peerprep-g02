import IORedis from "ioredis";

import { env } from "@/config/env.js";
import { logger } from "@/utils/logger.js";

/**
 * Creates dedicated pub/sub ioredis clients for the @socket.io/redis-adapter.
 * These are separate from the main data client because Redis Pub/Sub requires
 * a dedicated connection for subscriptions (it cannot execute normal commands).
 *
 * Importantly, these clients do NOT use keyPrefix — the adapter manages its own
 * "socket.io#" channel naming internally.
 */
export function createAdapterClients(): { pubClient: IORedis; subClient: IORedis } {
    const connectionOptions = {
        host: env.redisHost,
        port: env.redisPort,
        db: env.redisDb,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
            if (times > 3) {
                logger.error("Redis adapter client connection failed after 3 retries");
                return null;
            }
            return Math.min(times * 100, 3000);
        },
    };

    const pubClient = new IORedis(connectionOptions);
    const subClient = new IORedis(connectionOptions);

    pubClient.on("error", (error: unknown) => {
        logger.error({ err: error }, "Redis adapter pub client error");
    });

    subClient.on("error", (error: unknown) => {
        logger.error({ err: error }, "Redis adapter sub client error");
    });

    pubClient.on("ready", () => {
        logger.info("Redis adapter pub client ready");
    });

    subClient.on("ready", () => {
        logger.info("Redis adapter sub client ready");
    });

    return { pubClient, subClient };
}
