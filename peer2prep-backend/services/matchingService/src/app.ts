import cors from "cors";
import express from "express";

import internalRoutes from "@/routes/internalRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.status(200).send("Healthy"));
app.use("/v1/api/matching/internal", internalRoutes);

export default app;
