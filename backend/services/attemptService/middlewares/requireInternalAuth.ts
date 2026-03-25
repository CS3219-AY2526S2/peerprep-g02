import type { NextFunction, Request, Response } from "express";

import { AppConstants } from "@/constants.js";

export function requireInternalAuth(req: Request, res: Response, next: NextFunction): void {
    const internalServiceKey = req.header("x-internal-service-key");

    if (!AppConstants.INTERNAL_SERVICE_API_KEY) {
        res.status(500).json({ error: "Internal service auth is not configured." });
        return;
    }

    if (!internalServiceKey || internalServiceKey !== AppConstants.INTERNAL_SERVICE_API_KEY) {
        res.status(401).json({ error: "Unauthorized internal service request." });
        return;
    }

    next();
}
