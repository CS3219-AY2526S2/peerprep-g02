import { Router } from "express";
import { InternalAuthController } from "../controllers/InternalAuthController.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireInternalAuth } from "../middlewares/requireInternalAuth.js";

const internalAuthController = new InternalAuthController();
const internalAuthRoutes = Router();

internalAuthRoutes.use(requireInternalAuth);

internalAuthRoutes.get("/context", requireAuth(), (req, res) =>
    internalAuthController.authorizeContext(req, res),
);
internalAuthRoutes.post("/context/batch", async (req, res) =>
    internalAuthController.authorizeContextBatch(req, res),
);
export default internalAuthRoutes;
