import cors from "cors";
import express from "express";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.status(200).send("Healthy"));

export default app;
