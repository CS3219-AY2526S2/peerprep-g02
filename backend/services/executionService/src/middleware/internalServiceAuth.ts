import type { NextFunction, Request, Response } from "express";
import { env } from "@/config/env.js";

export function requireInternalAuth(req: Request, res: Response, next: NextFunction): void {
    const key = req.headers["x-internal-service-key"];

    if (!env.internalServiceApiKey) {
        res.status(500).json({ error: "Internal service key is not configured." });
        return;
    }

    if (key !== env.internalServiceApiKey) {
        res.status(401).json({ error: "Unauthorized." });
        return;
    }

    next();
}
