import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { swaggerOptions } from "@/config/swagger";

import dotenv from "dotenv";
dotenv.config();

const app = express();

if (process.env.MODE === "dev") {
  const swaggerSpec = swaggerJsdoc(swaggerOptions);
  app.use("/v1/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

//app.use(clerkMiddleware());
// have to pass webhook before express.json
//app.use("/v1/api/webhook", new WebhooksController().router);

app.use(express.json());

app.use(
    cors({
        origin: process.env.FRONTEND_ORIGIN,
        credentials: true,
    }),
);

app.use(helmet());

// Mount controllers


app.get("/v1/api/health", (req, res) => {
    res.status(200).json({ status: "ok", message: "API is running" });
});

export default app;