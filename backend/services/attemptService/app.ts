import cors from "cors";
import express from "express";

import { AppConstants } from "@/constants.js";
import attemptRoutes from "@/routes/attemptRoutes.js";

const app = express();

app.use(
    cors({
        origin: AppConstants.FRONTEND_ORIGIN,
        credentials: true,
    }),
);
app.use(express.json());

app.use("/attempts", attemptRoutes);
app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "attempt-service" });
});

export default app;
