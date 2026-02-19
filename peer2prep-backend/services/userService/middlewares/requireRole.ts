import { getAuth } from "@clerk/express";
import { NextFunction, Request, Response } from "express";

import { UserRole, userRepository } from "../models/User.js";
import { logger } from "../utils/logger.js";

// Middleware to check if authenticated+active user has required role.
export function requireRole(requiredRole: UserRole) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { userId } = getAuth(req);
            if (!userId) {
                res.status(401).json({ error: "Unauthorized." });
                return;
            }

            const user = await userRepository.findByClerkUserId(userId);
            if (!user) {
                res.status(403).json({ error: "Forbidden: local user not found." });
                return;
            }

            if (user.status !== "active") {
                res.status(403).json({ error: "Forbidden: account is not active." });
                return;
            }

            if (user.role !== requiredRole) {
                res.status(403).json({ error: `Forbidden: ${requiredRole} role required.` });
                return;
            }

            next();
        } catch (error) {
            logger.error({ err: error }, "Error in requireRole middleware");
            res.status(500).json({ error: "Failed to authorize role." });
        }
    };
}

export const requireAdmin = requireRole("admin");
