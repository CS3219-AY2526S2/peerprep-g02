import "dotenv/config";

import type { NextFunction, Request, Response } from "express";

const INTERNAL_SERVICE_API_KEY =
    process.env.INTERNAL_SERVICE_API_KEY ?? process.env.US_INTERNAL_SERVICE_API_KEY;

export function requireInternalAuth(req: Request, res: Response, next: NextFunction): void {
    const internalServiceKey = req.header("x-internal-service-key");

    if (!INTERNAL_SERVICE_API_KEY) {
        res.status(500).json({ error: "Internal service auth is not configured." });
        return;
    }

    if (!internalServiceKey || internalServiceKey !== INTERNAL_SERVICE_API_KEY) {
        res.status(401).json({ error: "Unauthorized internal service request." });
        return;
    }

    next();
}
