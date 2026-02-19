import dotenv from "dotenv";
import path from "path";
dotenv.config();

export const AppConstants = {
    DATABASE_URI: process.env.DATABASE_URI || "mongodb://localhost:27017/peer2prep",
    PORT: parseInt(process.env.PORT || "3000"),
    API_BASE_URI: process.env.API_BASE_URI || "http://localhost",
    API_VERSION: process.env.API_VERSION || "v1",
    FRONTEND_ORIGIN: process.env.FRONT_END_URI || "http://localhost:5173/",
    // CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY || "",
    // CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || "",
};

export const RedisConstants = {
    REDIS_HOST: process.env.REDIS_HOST || "redis",
    REDIS_PORT: parseInt(process.env.REDIS_PORT || "6379"),
    REDIS_USERNAME: process.env.REDIS_USERNAME || "",
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || "",
    REDIS_TTL: 60 * 60 * 1, // 1 hour
};

export const SocketConstants = {
    SOCKET_PORT: parseInt(process.env.SOCKET_PORT || "4000"),
    PING_TIMEOUT: 30_000, // 30 seconds
    PING_INTERVAL: 10_000, // 10 seconds
};


// if any are missing, throw an error
Object.keys(AppConstants).forEach((key) => {
    if (!AppConstants[key as keyof typeof AppConstants]) {
        throw new Error(`❌ Missing environment variable: ${key}`);
    }
});
