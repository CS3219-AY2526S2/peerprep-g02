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
import { startInstanceHeartbeat, stopInstanceHeartbeat } from "@/utils/instanceHeartbeat.js";
import { reconcileOrphanedSockets } from "@/utils/reconcilePresence.js";
import { closeRedis, getRedisClient } from "@/utils/redis.js";
import { createAdapterClients } from "@/utils/redisAdapter.js";

// Module-level references for graceful shutdown
let httpServer: ReturnType<typeof createServer> | null = null;
let ioServer: Server | null = null;
let adapterPubClient: ReturnType<typeof createAdapterClients>["pubClient"] | null = null;
let adapterSubClient: ReturnType<typeof createAdapterClients>["subClient"] | null = null;
let inactivityInterval: ReturnType<typeof setInterval> | null = null;
let isShuttingDown = false;

async function startServer(): Promise<void> {
    // Initialize Redis data connection
    const redis = getRedisClient();
    await redis.ping();
    logger.info("Redis connection verified");

    // Register this instance's liveness key before reconciliation so that
    // simultaneous startups don't treat each other as dead.
    await startInstanceHeartbeat();

    // Clean up socket bindings belonging to dead instances (best-effort).
    // A failure here should not prevent the service from starting.
    try {
        await reconcileOrphanedSockets();
    } catch (err) {
        logger.warn({ err }, "Orphaned socket reconciliation failed — continuing startup");
    }

    // Initialize Redis Pub/Sub clients for Socket.IO adapter
    const { pubClient, subClient } = createAdapterClients();
    adapterPubClient = pubClient;
    adapterSubClient = subClient;
    await Promise.all([pubClient.ping(), subClient.ping()]);
    logger.info("Redis adapter pub/sub clients verified");

    // Initialize RabbitMQ connection and assert queues
    const rabbitmq = RabbitMQManager.getInstance();
    await rabbitmq.connect();
    logger.info("RabbitMQ connected");

    httpServer = createServer(app);

    /**
     * F4.6.2 - Configure Socket.IO with heartbeat for connection monitoring
     */
    ioServer = new Server(httpServer, {
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
    ioServer.adapter(createAdapter(pubClient, subClient));
    logger.info("Socket.IO Redis adapter initialized");

    // Start RabbitMQ consumers that need the Socket.IO server instance
    rabbitmq.startConsumers(ioServer);
    logger.info("RabbitMQ execution response consumer started");

    ioServer.use(socketAuthMiddleware);
    inactivityInterval = registerSocketHandlers(ioServer);

    httpServer.listen(env.port, "0.0.0.0", () => {
        logger.info(`Collaboration Service live at http://localhost:${env.port}`);
    });
}

startServer().catch((error) => {
    logger.error({ err: error }, "Failed to start server");
    process.exit(1);
});

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) {
        logger.info({ signal }, "Shutdown already in progress, ignoring duplicate signal");
        return;
    }
    isShuttingDown = true;

    logger.info({ signal }, "Received shutdown signal, starting graceful shutdown...");

    // Hard deadline: force exit if cleanup hangs
    const forceExitTimer = setTimeout(() => {
        logger.error("Graceful shutdown timed out, forcing exit");
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExitTimer.unref();

    try {
        // 1. Stop periodic inactivity checks
        if (inactivityInterval) {
            clearInterval(inactivityInterval);
            inactivityInterval = null;
        }

        // 2. Stop accepting new connections
        if (httpServer) {
            await new Promise<void>((resolve) => {
                httpServer!.close(() => resolve());
            });
            logger.info("HTTP server closed");
        }

        // 3. Disconnect all sockets — fires disconnect handlers that
        //    clean up socket:* and presence:* Redis keys.
        //    Socket.IO's close() is callback-based, so wrap it in a Promise
        //    to ensure disconnect handlers finish before Redis teardown.
        if (ioServer) {
            await new Promise<void>((resolve) => {
                ioServer!.close(() => resolve());
            });
            logger.info("Socket.IO server closed");
        }

        // 4. Stop RabbitMQ consumers and close connection
        await RabbitMQManager.getInstance().close();
        logger.info("RabbitMQ connection closed");

        // 5. Close Redis adapter pub/sub clients
        if (adapterPubClient) {
            await adapterPubClient.quit();
        }
        if (adapterSubClient) {
            await adapterSubClient.quit();
        }
        logger.info("Redis adapter clients closed");

        // 6. Delete instance liveness key (uses main Redis client)
        await stopInstanceHeartbeat();

        // 7. Close main Redis client last (steps above depend on it)
        await closeRedis();

        logger.info("Graceful shutdown complete");
    } catch (err) {
        logger.error({ err }, "Error during graceful shutdown");
    }

    process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
