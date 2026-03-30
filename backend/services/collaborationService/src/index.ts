import "dotenv/config";

import { createServer } from "node:http";
import { Server } from "socket.io";

import app from "@/app.js";
import { env } from "@/config/env.js";
import { socketAuthMiddleware } from "@/middleware/socketAuth.js";
import { registerSocketHandlers } from "@/sockets/registerSocketHandlers.js";
import { logger } from "@/utils/logger.js";
import { getRedisClient } from "@/utils/redis.js";

async function startServer(): Promise<void> {
    // Initialize Redis connection
    const redis = getRedisClient();
    await redis.ping();
    logger.info("Redis connection verified");

    const server = createServer(app);

    /**
     * F4.6.2 - Configure Socket.IO with heartbeat for connection monitoring
     */
    const io = new Server(server, {
        cors: {
            origin: env.frontendUrl,
            credentials: true,
        },
        // Match the path used by the frontend through nginx
        path: "/sessions/socket.io/",
        // Heartbeat configuration for connection timeout detection
        pingInterval: env.heartbeatIntervalMs, // How often to send ping
        pingTimeout: env.heartbeatTimeoutMs, // How long to wait for pong before disconnect
    });

    io.use(socketAuthMiddleware);
    registerSocketHandlers(io);

    server.listen(env.port, "0.0.0.0", () => {
        logger.info(`Collaboration Service live at http://localhost:${env.port}`);
    });
}

startServer().catch((error) => {
    logger.error({ err: error }, "Failed to start server");
    process.exit(1);
});
