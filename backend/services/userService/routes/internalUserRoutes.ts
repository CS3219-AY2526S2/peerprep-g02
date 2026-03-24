import { Router } from "express";

import { InternalUserScoreController } from "@/controllers/InternalUserScoreController.js";
import { InternalUserValidationController } from "@/controllers/InternalUserValidationController.js";
import { requireInternalAuth } from "@/middlewares/requireInternalAuth.js";

const internalUserValidationController = new InternalUserValidationController();
const internalUserScoreController = new InternalUserScoreController();
const internalUserRoutes = Router();

internalUserRoutes.use(requireInternalAuth);

internalUserRoutes.post("/validation/batch", (req, res) =>
    internalUserValidationController.validateUsers(req, res),
);
internalUserRoutes.get("/:clerkUserId/score", (req, res) =>
    internalUserScoreController.getScore(req, res),
);
internalUserRoutes.put("/:clerkUserId/score", (req, res) =>
    internalUserScoreController.updateScore(req, res),
);

export default internalUserRoutes;
