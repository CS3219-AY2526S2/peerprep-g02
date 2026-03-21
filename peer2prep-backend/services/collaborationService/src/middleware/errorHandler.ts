import type { NextFunction, Request, Response } from "express";

import { HTTP_STATUS } from "@/config/constants.js";
import { logger } from "@/utils/logger.js";
import { toAppError } from "@/utils/errors.js";

export function errorHandler(
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void {
    const appError = toAppError(error);

    if (appError.statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
        logger.error({ err: appError, details: appError.details }, "Request failed");
    } else {
        logger.warn({ err: appError, details: appError.details }, "Request rejected");
    }

    res.status(appError.statusCode).json({
        error: appError.code,
        message: appError.message,
        details: appError.details,
    });
}
