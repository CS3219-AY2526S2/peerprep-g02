import express from "express";

import { requireInternalAuth } from "./middlewares/requireInternalAuth.js";
import attemptRoutes from "./routes/attemptRoutes.js";

const app = express();

app.use(express.json());

app.use("/attempts", requireInternalAuth, attemptRoutes);
app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "attempt-service" });
});

export default app;
