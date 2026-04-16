import cors from "cors";
import express from "express";

import { env } from "@/config/env.js";
import { errorHandler } from "@/middleware/errorHandler.js";

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

app.use(errorHandler);

export default app;
