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
// Skip auth for socket.io paths - Socket.IO handles these on the HTTP server with its own auth
app.use("/v1/api/sessions", (req, res, next) => {
    // Socket.IO paths should bypass Express - they're handled by Socket.IO attached to HTTP server
    // Don't call next() so request falls through to Socket.IO handler
    if (req.originalUrl.includes("/socket.io")) {
        return;
    }
    requireInternalServiceAuth(req, res, next);
}, sessionRoutes);
app.use(errorHandler);

export default app;
