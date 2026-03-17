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

        const controller = new AuthController();
        const req = createMockRequest();
        const res = createMockResponse();

        await controller.me(req, res);
        expect(handleErrorSpy).toHaveBeenCalledTimes(1);
        expect(handleErrorSpy).toHaveBeenCalledWith(res, expect.any(Error), "fetch me");
    });

    it("returns bad request for deleteAccount when getAuth has no userId", async () => {
        getAuthMock.mockReturnValue({ userId: null } as ReturnType<typeof getAuth>);
        const badRequestSpy = vi.spyOn(responseHelpers, "badRequest");
        const serviceSpy = vi.spyOn(AuthService.prototype, "deleteAccount");

        const controller = new AuthController();
        const req = createMockRequest();
        const res = createMockResponse();

        await controller.deleteAccount(req, res);
        expect(badRequestSpy).toHaveBeenCalledWith(res, "Authenticated userId is required.");
        expect(serviceSpy).not.toHaveBeenCalled();
    });

    it("returns 200 when deleteAccount succeeds", async () => {
        getAuthMock.mockReturnValue({ userId: "user_123" } as ReturnType<typeof getAuth>);
        vi.spyOn(AuthService.prototype, "deleteAccount").mockResolvedValue({
            message: "Account deleted successfully.",
        });

        const controller = new AuthController();
        const req = createMockRequest();
        const res = createMockResponse();

        await controller.deleteAccount(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: "Account deleted successfully." });
    });

    it("delegates deleteAccount errors to handleError", async () => {
        getAuthMock.mockReturnValue({ userId: "user_123" } as ReturnType<typeof getAuth>);
        vi.spyOn(AuthService.prototype, "deleteAccount").mockRejectedValue(
            new Error("delete failed"),
        );
        const handleErrorSpy = vi.spyOn(responseHelpers, "handleError");

        const controller = new AuthController();
        const req = createMockRequest();
        const res = createMockResponse();

        await controller.deleteAccount(req, res);
        expect(handleErrorSpy).toHaveBeenCalledTimes(1);
        expect(handleErrorSpy).toHaveBeenCalledWith(res, expect.any(Error), "delete account");
    });

    it("returns 200 for listUsers when service succeeds", async () => {
        getAuthMock.mockReturnValue({ userId: "admin_1" } as ReturnType<typeof getAuth>);
        vi.spyOn(AuthService.prototype, "listUsersForAdmin").mockResolvedValue({
            message: "Users fetched successfully.",
            data: {
                users: [],
            },
        });

        const controller = new AuthController();
        const req = createMockRequest();
        const res = createMockResponse();

        await controller.listUsers(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: "Users fetched successfully.",
            data: {
                users: [],
            },
        });
    });

    it("returns bad request for updateUserRole when role is invalid", async () => {
        getAuthMock.mockReturnValue({ userId: "admin_1" } as ReturnType<typeof getAuth>);
        const badRequestSpy = vi.spyOn(responseHelpers, "badRequest");

        const controller = new AuthController();
        const req = createMockRequest({
            params: { clerkUserId: "user_1" } as any,
            body: { role: "invalid" },
        });
        const res = createMockResponse();

        await controller.updateUserRole(req, res);
        expect(badRequestSpy).toHaveBeenCalledWith(res, "role must be either 'user' or 'admin'.");
    });

    it("returns 200 for updateUserStatus when service succeeds", async () => {
        getAuthMock.mockReturnValue({ userId: "admin_1" } as ReturnType<typeof getAuth>);
        vi.spyOn(AuthService.prototype, "updateUserStatusForAdmin").mockResolvedValue({
            message: "User status updated successfully.",
            data: {
                user: {
                    clerkUserId: "user_1",
                    role: "user",
                    status: "suspended",
                },
            },
        });

        const controller = new AuthController();
        const req = createMockRequest({
            params: { clerkUserId: "user_1" } as any,
            body: { status: "suspended" },
        });
        const res = createMockResponse();

        await controller.updateUserStatus(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: "User status updated successfully.",
            data: {
                user: {
                    clerkUserId: "user_1",
                    role: "user",
                    status: "suspended",
                },
            },
        });
    });
});
