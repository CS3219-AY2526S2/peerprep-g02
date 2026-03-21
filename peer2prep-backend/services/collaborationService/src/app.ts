import cors from "cors";
import express from "express";

import { errorHandler } from "@/middleware/errorHandler.js";
import { requireInternalServiceAuth } from "@/middleware/internalServiceAuth.js";
import sessionRoutes from "@/routes/sessionRoutes.js";
import { env } from "@/config/env.js";

const app = express();

app.use(
    cors({
        origin: env.frontendUrl,
        credentials: true,
    }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "collaboration-service" });
});

app.use("/v1/api", requireInternalServiceAuth, sessionRoutes);
app.use(errorHandler);

export default app;
