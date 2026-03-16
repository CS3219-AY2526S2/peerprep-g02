import "dotenv/config";

import { createServer } from "http";
import { Server } from "socket.io";

import app from "@/app.js";
import { socketAuthMiddleware } from "@/middlewares/socketAuth.js";
import { sessionRepository } from "@/repositories/sessionRepository.js";
import { registerCollaborationSocketHandlers } from "@/socket/registerCollaborationSocketHandlers.js";
import { serverLogger } from "@/utils/logger.js";
import { closePostgres, initializePostgres } from "@/utils/postgres.js";
import { closeRedis, connectRedis } from "@/utils/redis.js";

const port = Number(process.env.CS_SERVER_PORT ?? "3003");

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CS_FRONTEND_URL ?? "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true,
    },
});

let server: typeof httpServer | null = null;

async function shutdown(signal: string): Promise<void> {
    serverLogger.info({ signal }, "Shutting down collaboration service");
    await closeRedis();
    await closePostgres();

    if (server) {
        server.close();
    }
}

async function startServer(): Promise<void> {
    try {
        await initializePostgres();
        await sessionRepository.initialize();
        await connectRedis();
        io.use(socketAuthMiddleware);
        registerCollaborationSocketHandlers(io);

        server = httpServer.listen(port, "0.0.0.0", () => {
            serverLogger.info({ port }, "Collaboration Service started");
        });

        server.on("error", (err) => {
            serverLogger.error({ err }, "Collaboration Service failed to start");
            process.exit(1);
        });
    } catch (error) {
        serverLogger.error({ err: error }, "Collaboration Service failed to initialize");
        process.exit(1);
    }
}

process.on("SIGINT", () => {
    void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
});

void startServer();
