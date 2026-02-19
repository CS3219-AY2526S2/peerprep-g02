import pino from "pino";
import { pinoHttp } from "pino-http";

import { AppConstants } from "../constants.js";

const prettyTransport =
    AppConstants.MODE === "dev"
        ? {
              target: "pino-pretty",
              options: {
                  colorize: true,
                  translateTime: "SYS:standard",
                  ignore: "pid,hostname",
              },
          }
        : undefined;

export const logger = pino({
    name: "user-service",
    level: AppConstants.LOG_LEVEL,
    transport: prettyTransport,
});

export const httpLogger = pinoHttp({
    logger,
});
