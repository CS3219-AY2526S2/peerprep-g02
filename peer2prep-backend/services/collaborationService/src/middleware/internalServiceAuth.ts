import type { NextFunction, Request, Response } from "express";

import { ERROR_CODES, HTTP_STATUS } from "@/config/constants.js";
import { env } from "@/config/env.js";

export function requireInternalServiceAuth(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    const internalServiceKey = req.header("x-internal-service-key");

    if (!env.internalServiceApiKey || internalServiceKey !== env.internalServiceApiKey) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
            error: ERROR_CODES.UNAUTHORIZED_INTERNAL_REQUEST,
            message: "Unauthorized internal service request.",
        });
        return;
    }

    next();
}
