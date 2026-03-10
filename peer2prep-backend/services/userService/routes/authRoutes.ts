import { Router } from "express";
import { AuthController } from "../controllers/AuthController.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const authController = new AuthController();
const authRoutes = Router();

// Authenticated routes
// for /me, we allow missing local user since it's used for bootstrapping local user record from clerk profile on first login
authRoutes.get("/me", requireAuth({ allowMissingLocalUser: true }), (req, res) =>
    authController.me(req, res),
);
authRoutes.delete("/me", requireAuth(), (req, res) => authController.deleteAccount(req, res));
authRoutes.get("/admin/users", requireAuth({ requiredRole: "admin" }), (req, res) =>
    authController.listUsers(req, res),
);
authRoutes.patch("/admin/users/:clerkUserId/role", requireAuth({ requiredRole: "admin" }), (req, res) =>
    authController.updateUserRole(req, res),
);
authRoutes.patch("/admin/users/:clerkUserId/status", requireAuth({ requiredRole: "admin" }), (req, res) =>
    authController.updateUserStatus(req, res),
);

export default authRoutes;
