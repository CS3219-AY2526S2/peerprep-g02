import cors from "cors";
import express from "express";

import sessionRoutes from "@/routes/sessionRoutes.js";
import { collaborationConfig } from "@/services/config.js";

const app = express();

app.use(
    cors({
        origin: collaborationConfig.frontendUrl,
        credentials: true,
    }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "collaboration-service" });
});

app.use("/v1/api", sessionRoutes);

export default app;
