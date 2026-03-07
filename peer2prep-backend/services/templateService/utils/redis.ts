import { createClient } from "redis";
import { RedisConstants } from "@/constants.js";

const redisClient = createClient({
    username: RedisConstants.REDIS_USERNAME,
    password: RedisConstants.REDIS_PASSWORD,
    socket: {
        host: RedisConstants.REDIS_HOST,
        port: RedisConstants.REDIS_PORT,
    },
});

// Handle Redis connection events
redisClient.on("connect", () => console.log("Connected to Redis"));
redisClient.on("error", (err) => console.error("Redis Error:", err));

// Connect to Redis if not in test environment
if (process.env.NODE_ENV !== "test") {
    redisClient.connect();
}

export default redisClient;
