import dotenv from "dotenv";

dotenv.config();

export const AppConstants = {
    DATABASE_URI:
        process.env.DATABASE_URI || "postgresql://postgres:postgres@localhost:5432/peerprep_user",
    PORT: parseInt(process.env.PORT || "3001", 10),
    API_BASE_URI: process.env.API_BASE_URI || "http://localhost",
    FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    MODE: process.env.MODE || "dev",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    INTERNAL_SERVICE_API_KEY: process.env.INTERNAL_SERVICE_API_KEY,
    CLERK_WEBHOOK_SIGNING_SECRET: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
    CLERK_SUPERUSER_ID: process.env.CLERK_SUPERUSER_ID,
    DEFAULT_PREFERRED_LANGUAGE: "Python",
};
