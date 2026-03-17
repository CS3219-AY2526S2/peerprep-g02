/** Creates the collaboration service Redis client used for session cache persistence. */
import { Redis } from "ioredis";

import { collaborationConfig } from "@/services/config.js";
import { logger } from "@/utils/logger.js";

export const redisClient = new Redis({
    host: collaborationConfig.redisHost,
    port: collaborationConfig.redisPort,
    username: collaborationConfig.redisUsername,
    password: collaborationConfig.redisPassword,
    db: collaborationConfig.redisDb,
    keyPrefix: collaborationConfig.redisKeyPrefix,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
});

redisClient.on("connect", () => {
    logger.info("Connected to Redis");
});

redisClient.on("error", (error: Error) => {
    logger.error({ err: error }, "Redis client error");
});
