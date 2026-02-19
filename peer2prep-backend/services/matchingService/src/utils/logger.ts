import pino, { type LoggerOptions } from "pino";
import "dotenv/config";

const isDevelopment = process.env.MS_ENV === "development";

const pinoOptions: LoggerOptions = {
    level: "info",
};

if (isDevelopment) {
    pinoOptions.transport = {
        target: "pino-pretty",
        options: {
            colorize: true,
            translateTime: "SYS:standard",
            messageFormat: "[{service}] {msg}",
            ignore: "pid,hostname,service",
        },
    };
}

const baseLogger = pino(pinoOptions);

export const mainLogger = baseLogger.child({ service: "main" });
export const redisLogger = baseLogger.child({ service: "redis" });
export const socketLogger = baseLogger.child({ service: "socket" });
export const matchLogger = baseLogger.child({ service: "match" });
