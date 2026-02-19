import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { swaggerOptions } from "./config/swagger.js";
import { clerkMiddleware } from "@clerk/express";
import authRoutes from "./routes/authRoutes.js";
import { AppConstants } from "./constants.js";
import { httpLogger } from "./utils/logger.js";
const app = express();

if (AppConstants.MODE === "dev") {
    const swaggerSpec = swaggerJsdoc(swaggerOptions);
    app.use("/v1/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.use(clerkMiddleware());
app.use(express.json());
app.use(
    cors({
        origin: AppConstants.FRONTEND_ORIGIN,
        credentials: true,
    }),
);

app.use(helmet());
app.use(httpLogger);

// Mount controllers
app.use("/v1/api/users/auth", authRoutes);
app.get("/v1/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", message: "API is running" });
});

export default app;
