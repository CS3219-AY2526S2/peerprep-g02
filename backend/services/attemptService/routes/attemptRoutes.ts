import { Router } from "express";

import { AttemptController } from "@/controllers/AttemptController.js";
import { requireAuth } from "@/middlewares/requireAuth.js";
import { requireInternalAuth } from "@/middlewares/requireInternalAuth.js";

const attemptController = new AttemptController();
const attemptRoutes = Router();

attemptRoutes.get("/me", requireAuth, (req, res) =>
    attemptController.listAttemptsForCurrentUser(req, res),
);
attemptRoutes.post("/", requireInternalAuth, (req, res) => attemptController.create(req, res));
attemptRoutes.get("/users/:clerkUserId/questions", requireInternalAuth, (req, res) =>
    attemptController.listUniqueQuestions(req, res),
);

export default attemptRoutes;
