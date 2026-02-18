import { createClient, type RedisClientType } from "redis";

class RedisManager {
    private static instance: RedisClientType;
    private static isConnected = false;

    private constructor() {}

    public static getInstance(): RedisClientType {
        if (!this.instance) {
            const redisUrl = process.env.MS_REDIS_URL;
            if (!redisUrl) {
                throw new Error(`Redis URL is undefined`);
            }

            this.instance = createClient({
                url: redisUrl,
            });

            this.instance.on("error", (err) => console.error("Redis Error:", err));
            this.instance.on("connect", () => {
                this.isConnected = true;
                console.log("Redis connected");
            });
        }
        return this.instance;
    }

    public static async connect(): Promise<void> {
        if (!this.isConnected) {
            await this.getInstance().connect();
        }
    }

    public static async disconnect(): Promise<void> {
        if (this.isConnected) {
            await this.instance.close();
            this.isConnected = false;
            console.log("Redis connection closed");
        }
    }
}

export default RedisManager;
