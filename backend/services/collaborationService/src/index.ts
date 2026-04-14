import "dotenv/config";

import { createServer } from "node:http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";

import app from "@/app.js";
import { env } from "@/config/env.js";
import { RabbitMQManager } from "@/managers/rabbitmqManager.js";
import { socketAuthMiddleware } from "@/middleware/socketAuth.js";
import { registerSocketHandlers } from "@/sockets/registerSocketHandlers.js";
import { logger } from "@/utils/logger.js";
import { reconcileOrphanedSockets } from "@/utils/reconcilePresence.js";
import { getRedisClient } from "@/utils/redis.js";
import { createAdapterClients } from "@/utils/redisAdapter.js";

async function startServer(): Promise<void> {
    // Initialize Redis data connection
    const redis = getRedisClient();
    await redis.ping();
    logger.info("Redis connection verified");

    // Clean up any socket/presence keys orphaned by a previous crash
    await reconcileOrphanedSockets();

    // Initialize Redis Pub/Sub clients for Socket.IO adapter
    const { pubClient, subClient } = createAdapterClients();
    await Promise.all([pubClient.ping(), subClient.ping()]);
    logger.info("Redis adapter pub/sub clients verified");

    // Initialize RabbitMQ connection and assert queues
    const rabbitmq = RabbitMQManager.getInstance();
    await rabbitmq.connect();
    logger.info("RabbitMQ connected");

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

    // Attach Redis adapter for cross-instance Socket.IO event synchronization
    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Socket.IO Redis adapter initialized");

    // Start RabbitMQ consumers that need the Socket.IO server instance
    rabbitmq.startConsumers(io);
    logger.info("RabbitMQ execution response consumer started");

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
