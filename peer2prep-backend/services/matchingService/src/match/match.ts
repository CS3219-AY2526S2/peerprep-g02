import RedisManager from "@/managers/redisManager.js";

export const findMatch = async (userId: string) => {
    const redis = RedisManager.getInstance();
    const key = "simpleQueue";
    const res = await redis.lPush(key, userId);
    console.log(`User ${userId} added to queue, response: ${res}`);
};
