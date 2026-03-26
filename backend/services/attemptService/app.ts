import express from "express";

import attemptRoutes from "@/routes/attemptRoutes.js";

const app = express();

app.use(express.json());

app.use("/attempts", attemptRoutes);
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "attempt-service" });
});

export default app;
