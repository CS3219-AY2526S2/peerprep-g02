import { createClient, type RedisClientType } from "redis";

class RedisManager {
    private static instance: RedisClientType;
    private static isConnected = false;

    private constructor() {}

    public static getInstance(): RedisClientType {
        if (!this.instance) {
            this.instance = createClient({
                url: "redis://127.0.0.1:6379",
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
