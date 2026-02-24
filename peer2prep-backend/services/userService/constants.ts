import dotenv from "dotenv";

dotenv.config();

export const AppConstants = {
    DATABASE_URI:
        process.env.DATABASE_URI || "postgresql://postgres:postgres@localhost:5432/peer2prep_user",
    PORT: parseInt(process.env.PORT || "3001", 10),
    API_BASE_URI: process.env.API_BASE_URI || "http://localhost",
    FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    MODE: process.env.MODE || "dev",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
};
