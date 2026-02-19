import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "@clerk/express";

import { AuthController } from "../../controllers/AuthController.js";
import { AuthService } from "../../services/authService.js";
import * as responseHelpers from "../../utils/ResponseHelpers.js";
import { createMockRequest, createMockResponse } from "../helpers/httpMocks.js";

vi.mock("@clerk/express", () => ({
    getAuth: vi.fn(),
}));

// test for AuthController.me
describe("AuthController", () => {
    const getAuthMock = vi.mocked(getAuth);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // no userID
    it("returns bad request when getAuth has no userId", async () => {
        getAuthMock.mockReturnValue({ userId: null } as ReturnType<typeof getAuth>);
        const badRequestSpy = vi.spyOn(responseHelpers, "badRequest");
        const serviceSpy = vi.spyOn(AuthService.prototype, "me");

        const controller = new AuthController();
        const req = createMockRequest();
        const res = createMockResponse();

        await controller.me(req, res);
        expect(badRequestSpy).toHaveBeenCalledWith(res, "Authenticated userId is required.");
        expect(serviceSpy).not.toHaveBeenCalled();
    });

    // successful case
    it("returns 200 and payload when service succeeds", async () => {
        getAuthMock.mockReturnValue({ userId: "user_123" } as ReturnType<typeof getAuth>);
        vi.spyOn(AuthService.prototype, "me").mockResolvedValue({
            message: "User profile fetched successfully.",
            data: {
                user: {
                    clerkUserId: "user_123",
                    name: "Alice",
                    email: "alice@example.com",
                    status: "active",
                    role: "user",
                    avatarUrl: null,
                    preferredLanguage: null,
                    lastLoginAt: null,
                },
            },
        });

        const controller = new AuthController();
        const req = createMockRequest();
        const res = createMockResponse();

        await controller.me(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: "User profile fetched successfully.",
            data: {
                user: {
                    clerkUserId: "user_123",
                    name: "Alice",
                    email: "alice@example.com",
                    status: "active",
                    role: "user",
                    avatarUrl: null,
                    preferredLanguage: null,
                    lastLoginAt: null,
                },
            },
        });
    });

    // service throws error
    it("delegates errors to handleError", async () => {
        getAuthMock.mockReturnValue({ userId: "user_123" } as ReturnType<typeof getAuth>);
        vi.spyOn(AuthService.prototype, "me").mockRejectedValue(new Error("service failed"));
        const handleErrorSpy = vi.spyOn(responseHelpers, "handleError");
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

        const controller = new AuthController();
        const req = createMockRequest();
        const res = createMockResponse();

        await controller.me(req, res);
        expect(handleErrorSpy).toHaveBeenCalledTimes(1);
        expect(handleErrorSpy).toHaveBeenCalledWith(res, expect.any(Error), "fetch me");
        consoleSpy.mockRestore();
    });
});
