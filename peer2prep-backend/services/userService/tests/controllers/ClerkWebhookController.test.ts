import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebhookEvent } from "@clerk/express/webhooks";
import { verifyWebhook } from "@clerk/express/webhooks";
import { ClerkWebhookController } from "../../controllers/ClerkWebhookController.js";
import { ClerkWebhookService } from "../../services/clerkWebhookService.js";
import { createMockRequest, createMockResponse } from "../helpers/httpMocks.js";

vi.mock("@clerk/express/webhooks", () => ({
    verifyWebhook: vi.fn(),
}));

describe("ClerkWebhookController", () => {
    const verifyWebhookMock = vi.mocked(verifyWebhook);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // wrong signature
    it("returns 400 when webhook verification fails", async () => {
        verifyWebhookMock.mockRejectedValue(new Error("signature verification failed"));

        const controller = new ClerkWebhookController();
        const req = createMockRequest({ body: {} });
        const res = createMockResponse();

        await controller.handle(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: "Invalid Clerk webhook signature." });
    });

    // success case
    it("returns 200 when webhook is processed", async () => {
        verifyWebhookMock.mockResolvedValue({
            type: "user.updated",
            object: "event",
            data: { id: "user_123" },
            event_attributes: { http_request: { client_ip: "127.0.0.1", user_agent: "test" } },
        } as unknown as WebhookEvent);
        const processSpy = vi
            .spyOn(ClerkWebhookService.prototype, "process")
            .mockResolvedValue(undefined);

        const controller = new ClerkWebhookController();
        const req = createMockRequest({ body: {} });
        const res = createMockResponse();

        await controller.handle(req, res);

        expect(processSpy).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: "Webhook processed." });
    });
});
