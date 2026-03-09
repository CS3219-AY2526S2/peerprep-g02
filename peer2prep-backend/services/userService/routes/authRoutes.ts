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

export default authRoutes;
