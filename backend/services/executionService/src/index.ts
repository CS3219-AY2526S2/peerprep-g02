import "dotenv/config";

import cors from "cors";
import express from "express";

import { env } from "@/config/env.js";
import executeRoutes from "@/routes/executeRoutes.js";
import { ensurePistonRuntimes } from "@/services/pistonSetup.js";
import { logger } from "@/utils/logger.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "execution-service" });
});

app.use("/execute", executeRoutes);

app.listen(env.port, "0.0.0.0", () => {
    logger.info(`Execution Service live at http://localhost:${env.port}`);

    // Install Piston runtimes in the background (non-blocking)
    ensurePistonRuntimes().catch((error) => {
        logger.error({ err: error }, "Piston runtime setup failed - code execution may not work");
    });
});
