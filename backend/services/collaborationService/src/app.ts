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

// API routes require internal service authentication
// Socket.IO paths are handled by Socket.IO on the HTTP server with its own auth middleware
app.use("/sessions", requireInternalServiceAuth, sessionRoutes);
app.use(errorHandler);

export default app;
