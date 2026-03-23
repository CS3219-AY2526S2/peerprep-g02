import app from "./app.js";
import { AppConstants } from "./constants.js";
import { logger } from "./utils/logger.js";
import { closePostgres, initializePostgres } from "./utils/postgres.js";

async function startServer(): Promise<void> {
    try {
        await initializePostgres();
        logger.info("Attempt service PostgreSQL connected");

        app.listen(AppConstants.PORT, "0.0.0.0", () => {
            logger.info(
                `Attempt service listening on ${AppConstants.API_BASE_URI}:${AppConstants.PORT}`,
            );
        });
    } catch (error) {
        logger.error({ err: error }, "Attempt service failed to start");
        process.exit(1);
    }
}

void startServer();

process.on("SIGINT", async () => {
    logger.info("Received SIGINT. Shutting down attempt service.");
    await closePostgres();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    logger.info("Received SIGTERM. Shutting down attempt service.");
    await closePostgres();
    process.exit(0);
});
