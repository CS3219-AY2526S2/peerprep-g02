import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "@clerk/express";

import { requireAuth } from "../../middlewares/requireAuth.js";
import { userRepository } from "../../models/User.js";
import { createMockNext, createMockRequest, createMockResponse } from "../helpers/httpMocks.js";

vi.mock("@clerk/express", () => ({
    getAuth: vi.fn(),
}));

// test for requireAuth
describe("requireAuth", () => {
    const getAuthMock = vi.mocked(getAuth);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // unauthenticated
    it("returns 401 when request is unauthenticated", async () => {
        getAuthMock.mockReturnValue({ userId: null } as ReturnType<typeof getAuth>);

        const req = createMockRequest();
        const res = createMockResponse();
        const next = createMockNext();

        await requireAuth()(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized." });
        expect(next).not.toHaveBeenCalled();
    });

    // missing local user record (default case)
    it("returns 403 when local user record is missing by default", async () => {
        getAuthMock.mockReturnValue({ userId: "user_123" } as ReturnType<typeof getAuth>);
        vi.spyOn(userRepository, "findByClerkUserId").mockResolvedValue(null);

        const req = createMockRequest();
        const res = createMockResponse();
        const next = createMockNext();

        await requireAuth()(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: "Forbidden: local user not found." });
        expect(next).not.toHaveBeenCalled();
    });

    // allow missing local user record for routes like /me
    it("allows missing local user when allowMissingLocalUser is true", async () => {
        getAuthMock.mockReturnValue({ userId: "user_123" } as ReturnType<typeof getAuth>);
        vi.spyOn(userRepository, "findByClerkUserId").mockResolvedValue(null);

        const req = createMockRequest();
        const res = createMockResponse();
        const next = createMockNext();

        await requireAuth({ allowMissingLocalUser: true })(req, res, next);

        expect(next).toHaveBeenCalledOnce();
    });

    // inactive user
    it("returns 403 when local user is not active", async () => {
        getAuthMock.mockReturnValue({ userId: "user_123" } as ReturnType<typeof getAuth>);
        vi.spyOn(userRepository, "findByClerkUserId").mockResolvedValue({
            clerkUserId: "user_123",
            name: "Alice",
            avatarUrl: null,
            status: "suspended",
            role: "user",
            preferredLanguage: null,
            lastLoginAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const req = createMockRequest();
        const res = createMockResponse();
        const next = createMockNext();

        await requireAuth()(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: "Forbidden: account is not active." });
        expect(next).not.toHaveBeenCalled();
    });

    // successful case
    it("calls next", async () => {
        getAuthMock.mockReturnValue({ userId: "user_123" } as ReturnType<typeof getAuth>);
        vi.spyOn(userRepository, "findByClerkUserId").mockResolvedValue({
            clerkUserId: "user_123",
            name: "Alice",
            avatarUrl: null,
            status: "active",
            role: "user",
            preferredLanguage: null,
            lastLoginAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const req = createMockRequest();
        const res = createMockResponse();
        const next = createMockNext();

        await requireAuth()(req, res, next);

        expect(next).toHaveBeenCalledOnce();
        expect(res.status).not.toHaveBeenCalled();
    });

    it("returns 500 when local user lookup throws", async () => {
        getAuthMock.mockReturnValue({ userId: "user_123" } as ReturnType<typeof getAuth>);
        vi.spyOn(userRepository, "findByClerkUserId").mockRejectedValue(new Error("db fail"));
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

        const req = createMockRequest();
        const res = createMockResponse();
        const next = createMockNext();

        await requireAuth()(req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: "Failed to authorize user." });
        expect(next).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});
