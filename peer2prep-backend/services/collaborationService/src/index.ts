import "dotenv/config";

import app from "@/app.js";
import { sessionRepository } from "@/repositories/sessionRepository.js";
import { serverLogger } from "@/utils/logger.js";
import { closePostgres, initializePostgres } from "@/utils/postgres.js";
import { closeRedis, connectRedis } from "@/utils/redis.js";

const port = Number(process.env.CS_SERVER_PORT ?? "3003");

let server: ReturnType<typeof app.listen> | null = null;

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

        server = app.listen(port, "0.0.0.0", () => {
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
