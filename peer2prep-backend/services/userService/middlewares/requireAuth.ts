import { getAuth } from "@clerk/express";
import { NextFunction, Request, Response } from "express";
import { UserRole, userRepository } from "../models/User.js";
import { logger } from "../utils/logger.js";

type RequireAuthOptions = {
    allowMissingLocalUser?: boolean;
    requiredRole?: UserRole;
};

// Middleware to check if user is authenticated and active.
// For bootstrap routes like /me, allow missing local user via options.
export function requireAuth(options: RequireAuthOptions = {}) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { userId } = getAuth(req);

            // returns 401 if not authenticated
            if (!userId) {
                res.status(401).json({ error: "Unauthorized." });
                return;
            }

            const user = await userRepository.findByClerkUserId(userId);
            if (!user) {
                if (options.allowMissingLocalUser && !options.requiredRole) {
                    next();
                    return;
                }

                res.status(403).json({ error: "Forbidden: local user not found." });
                return;
            }

            // inactive user
            if (user.status !== "active") {
                res.status(403).json({ error: "Forbidden: account is not active." });
                return;
            }

            // role check
            if (options.requiredRole && user.role !== options.requiredRole) {
                res.status(403).json({
                    error: `Forbidden: ${options.requiredRole} role required.`,
                });
                return;
            }

            next();
        } catch (error) {
            logger.error({ err: error }, "Error in requireAuth middleware");
            res.status(500).json({ error: "Failed to authorize user." });
        }
    };
}
