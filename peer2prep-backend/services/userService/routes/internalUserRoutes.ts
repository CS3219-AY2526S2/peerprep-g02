import { Router } from "express";

import { InternalUserValidationController } from "../controllers/InternalUserValidationController.js";
import { requireInternalAuth } from "../middlewares/requireInternalAuth.js";

const internalUserValidationController = new InternalUserValidationController();
const internalUserRoutes = Router();

internalUserRoutes.use(requireInternalAuth);

internalUserRoutes.post("/validation/batch", (req, res) =>
    internalUserValidationController.validateUsers(req, res),
);

export default internalUserRoutes;
