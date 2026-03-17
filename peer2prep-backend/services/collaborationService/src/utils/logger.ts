/** Provides the collaboration service logger instance and shared logging configuration. */
import pino from "pino";

export const logger = pino({
    level: process.env.CS_LOG_LEVEL ?? "info",
});
