import { describe, expect, it } from "vitest";
import { InternalAuthController } from "../../controllers/InternalAuthController.js";
import { createMockRequest, createMockResponse } from "../helpers/httpMocks.js";

describe("InternalAuthController", () => {
    it("returns 500 when clerk user context is missing for context authorization", () => {
        const controller = new InternalAuthController();
        const req = createMockRequest();
        const res = createMockResponse();

        controller.authorizeContext(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: "Authenticated user context is missing.",
        });
    });

    it("returns 200 and auth context for context authorization", () => {
        const controller = new InternalAuthController();
        const req = createMockRequest();
        const res = createMockResponse();
        res.locals.clerkUserId = "user_123";
        res.locals.authUser = {
            clerkUserId: "user_123",
            role: "user",
            status: "active",
        };

        controller.authorizeContext(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            authorized: true,
            data: {
                clerkUserId: "user_123",
                role: "user",
                status: "active",
            },
        });
    });

});
