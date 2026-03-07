import "dotenv/config";

import { createServer } from "http";
import { Server } from "socket.io";

import app from "@/app.js";
import RedisManager from "@/managers/redisManager.js";
import { registerSocketHandlers } from "@/managers/socketManager.js";
import { mainLogger } from "@/utils/logger.js";

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.MS_FRONTEND_URL,
        methods: ["GET", "POST"],
        credentials: true
    }
});

const startServer = async () => {
    try {
        await RedisManager.connect();
        registerSocketHandlers(io);

        server.listen(process.env.MS_SERVER_PORT, () => {
            mainLogger.info(
                `Matching Service live at http://localhost:${process.env.MS_SERVER_PORT}`,
            );
        });
    } catch (error) {
        mainLogger.error(error, "Failed to start Matching Service");
        process.exit(1);
    }
};

process.on("SIGINT", async () => {
    mainLogger.info("Shutting down...");
    await RedisManager.disconnect();
    process.exit(0);
});

startServer();
