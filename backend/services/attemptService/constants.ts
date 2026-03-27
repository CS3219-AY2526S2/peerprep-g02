import dotenv from "dotenv";

dotenv.config();

function readNumber(value: string | undefined, fallback: number): number {
    if (!value) {
        return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function trimTrailingSlash(value: string | undefined): string | undefined {
    return value?.replace(/\/+$/, "");
}

export const AppConstants = {
    DATABASE_URI:
        process.env.DATABASE_URI ||
        "postgresql://postgres:postgres@localhost:5432/peerprep_attempt",
    PORT: readNumber(process.env.PORT, 3004),
    API_BASE_URI: process.env.API_BASE_URI || "http://localhost",
    FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    MODE: process.env.MODE || "dev",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    INTERNAL_SERVICE_API_KEY: process.env.INTERNAL_SERVICE_API_KEY ?? "",
    USER_SERVICE_URL: trimTrailingSlash(process.env.USER_SERVICE_URL) || "http://user-service:3001",
    DEPENDENCY_TIMEOUT_MS: readNumber(process.env.DEPENDENCY_TIMEOUT_MS, 5000),
};
