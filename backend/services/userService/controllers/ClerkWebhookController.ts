import type { Request, Response } from "express";
import { verifyWebhook } from "@clerk/express/webhooks";
import { AppConstants } from "@/constants.js";
import { ClerkWebhookService } from "@/services/clerkWebhookService.js";
import { handleError } from "@/utils/ResponseHelpers.js";
import { logger } from "@/utils/logger.js";

export class ClerkWebhookController {
    private readonly clerkWebhookService = new ClerkWebhookService();

    /**
     * @swagger
     * /users/webhooks/clerk:
     *   post:
     *     summary: Receive Clerk webhook events and sync local user records.
     *     security: []
     */
    async handle(req: Request, res: Response): Promise<Response | void> {
        if (!AppConstants.CLERK_WEBHOOK_SIGNING_SECRET) {
            return res.status(500).json({
                error: "CLERK_WEBHOOK_SIGNING_SECRET is not configured.",
            });
        }

        try {
            const event = await verifyWebhook(req, {
                signingSecret: AppConstants.CLERK_WEBHOOK_SIGNING_SECRET,
            });

            const payload = event.data as { id?: string };
            await this.clerkWebhookService.process(event);
            logger.info(
                {
                    eventType: event.type,
                    clerkUserId: payload?.id,
                },
                "Processed Clerk webhook event",
            );
            return res.status(200).json({ message: "Webhook processed." });
        } catch (error) {
            if (error instanceof Error && /webhook|signature|svix/i.test(error.message)) {
                return res.status(400).json({ error: "Invalid Clerk webhook signature." });
            }

            handleError(res, error, "process clerk webhook");
        }
    }
}
