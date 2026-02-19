import RedisManager from "@/managers/redisManager.js";
import { matchLogger } from "@/utils/logger.js";

export const findMatch = async (userId: string) => {
    const redis = RedisManager.getInstance();
    const key = "simpleQueue";
    const res = await redis.lPush(key, userId);
    matchLogger.info(`User ${userId} added to queue, response: ${res}`);
};
