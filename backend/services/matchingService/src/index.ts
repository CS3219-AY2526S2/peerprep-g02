import "dotenv/config";

import { createServer } from "http";
import { Server } from "socket.io";

import app from "@/app.js";
import { RabbitMQManager } from "@/managers/rabbitmqManager.js";
import RedisManager from "@/managers/redisManager.js";
import { registerSocketHandlers } from "@/managers/socketManager.js";
import { socketAuthMiddleware } from "@/middlewares/socketAuth.js";
import { mainLogger } from "@/utils/logger.js";

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        credentials: true,
    },
});

const startServer = async () => {
    try {
        await RedisManager.connect();
        io.use(socketAuthMiddleware);
        registerSocketHandlers(io);
        mainLogger.info("Socket.IO handlers registered successfully");

        await RabbitMQManager.getInstance().connect(io);
        mainLogger.info("RabbitMQ Manager connected successfully");

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

process.on("unhandledRejection", (reason, promise) => {
    mainLogger.error({ reason, promise }, "Unhandled Promise Rejection");
});

process.on("uncaughtException", (error) => {
    mainLogger.error(error, "Uncaught Exception");
    process.exit(1);
});

process.on("SIGINT", async () => {
    mainLogger.info("Shutting down...");
    await RedisManager.disconnect();
    process.exit(0);
});

startServer();
