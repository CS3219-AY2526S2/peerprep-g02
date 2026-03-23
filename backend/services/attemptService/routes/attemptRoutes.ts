import { Router } from "express";

import { AttemptController } from "../controllers/AttemptController.js";

const attemptController = new AttemptController();
const attemptRoutes = Router();

attemptRoutes.post("/", (req, res) => attemptController.create(req, res));
attemptRoutes.get("/users/:clerkUserId/questions", (req, res) =>
    attemptController.listUniqueQuestions(req, res),
);

export default attemptRoutes;
