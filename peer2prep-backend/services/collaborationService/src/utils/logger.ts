import pino from "pino";
import { pinoHttp } from "pino-http";

const baseLogger = pino({
    name: "collaboration-service",
    level: process.env.CS_LOG_LEVEL ?? "info",
});

export const logger = baseLogger;
export const appLogger = baseLogger.child({ component: "app" });
export const serverLogger = baseLogger.child({ component: "server" });
export const sessionLogger = baseLogger.child({ component: "session" });
export const authLogger = baseLogger.child({ component: "auth" });
export const socketLogger = baseLogger.child({ component: "socket" });
export const redisLogger = baseLogger.child({ component: "redis" });

export const httpLogger = pinoHttp({
    logger: appLogger,
});
