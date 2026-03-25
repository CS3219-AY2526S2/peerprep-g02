import { NextFunction, Request, Response } from "express";
import { AppConstants } from "@/constants.js";

export function requireInternalAuth(req: Request, res: Response, next: NextFunction): void {
    const internalServiceKey = req.header("x-internal-service-key");
    if (!internalServiceKey || internalServiceKey !== AppConstants.INTERNAL_SERVICE_API_KEY) {
        res.status(401).json({ error: "Unauthorized internal service request." });
        return;
    }

    next();
}
