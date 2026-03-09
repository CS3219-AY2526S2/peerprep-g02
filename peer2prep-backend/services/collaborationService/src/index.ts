import "dotenv/config";

import app from "@/app.js";
import { serverLogger } from "@/utils/logger.js";

const port = Number(process.env.CS_SERVER_PORT ?? "3003");

const server = app.listen(port, "0.0.0.0", () => {
    serverLogger.info({ port }, "Collaboration Service started");
});

server.on("error", (err) => {
    serverLogger.error({ err }, "Collaboration Service failed to start");
    process.exit(1);
});

process.on("SIGINT", () => {
    serverLogger.info("Received SIGINT. Shutting down collaboration service.");
    server.close();
});

process.on("SIGTERM", () => {
    serverLogger.info("Received SIGTERM. Shutting down collaboration service.");
    server.close();
});
