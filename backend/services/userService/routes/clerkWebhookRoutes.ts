import { Router } from "express";
import { ClerkWebhookController } from "@/controllers/ClerkWebhookController.js";

const clerkWebhookController = new ClerkWebhookController();
const clerkWebhookRoutes = Router();

clerkWebhookRoutes.post("/", (req, res) => clerkWebhookController.handle(req, res));

export default clerkWebhookRoutes;
