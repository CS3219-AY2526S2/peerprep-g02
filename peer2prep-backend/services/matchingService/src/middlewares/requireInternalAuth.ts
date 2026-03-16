import { type NextFunction, type Request, type Response } from "express";

export function requireInternalAuth(req: Request, res: Response, next: NextFunction): void {
    const internalServiceKey = req.header("x-internal-service-key");
    const expectedKey = process.env.INTERNAL_SERVICE_API_KEY;

    if (!internalServiceKey || !expectedKey || internalServiceKey !== expectedKey) {
        res.status(401).json({ error: "Unauthorized internal service request." });
        return;
    }

    next();
}
