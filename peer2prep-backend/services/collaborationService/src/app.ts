import cors from "cors";
import express from "express";

import sessionRoutes from "@/routes/sessionRoutes.js";

const app = express();

app.use(
    cors({
        origin: process.env.CS_FRONTEND_URL ?? "http://localhost:5173",
        credentials: true,
    }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "collaboration-service" });
});

app.use("/v1/api", sessionRoutes);

export default app;
