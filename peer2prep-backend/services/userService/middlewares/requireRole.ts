import { UserRole } from "../models/User.js";
import { requireAuth } from "./requireAuth.js";

// Role-based auth middleware built on top of requireAuth options.
export function requireRole(requiredRole: UserRole) {
    return requireAuth({
        requiredRole,
    });
}

export const requireAdmin = requireRole("admin");
