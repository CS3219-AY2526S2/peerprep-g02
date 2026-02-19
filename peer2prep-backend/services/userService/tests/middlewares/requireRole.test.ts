import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "@clerk/express";

import { requireRole } from "../../middlewares/requireRole.js";
import { userRepository } from "../../models/User.js";
import { createMockNext, createMockRequest, createMockResponse } from "../helpers/httpMocks.js";

vi.mock("@clerk/express", () => ({
    getAuth: vi.fn(),
}));

describe("requireRole", () => {
    const getAuthMock = vi.mocked(getAuth);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // unauthenticated
    it("returns 401 when no authenticated user exists", async () => {
        getAuthMock.mockReturnValue({ userId: null } as ReturnType<typeof getAuth>);

        const req = createMockRequest();
        const res = createMockResponse();
        const next = createMockNext();

        await requireRole("admin")(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized." });
        expect(next).not.toHaveBeenCalled();
    });

    // local user not found
    it("returns 403 when active user context is missing", async () => {
        getAuthMock.mockReturnValue({ userId: "user_123" } as ReturnType<typeof getAuth>);
        vi.spyOn(userRepository, "findByClerkUserId").mockResolvedValue(null);

        const req = createMockRequest();
        const res = createMockResponse();
        const next = createMockNext();

        await requireRole("admin")(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: "Forbidden: local user not found." });
        expect(next).not.toHaveBeenCalled();
    });

    // inactive user
    it("returns 403 when local user is not active", async () => {
        getAuthMock.mockReturnValue({ userId: "user_123" } as ReturnType<typeof getAuth>);
        vi.spyOn(userRepository, "findByClerkUserId").mockResolvedValue({
            clerkUserId: "user_123",
            name: "Alice",
            avatarUrl: null,
            status: "suspended",
            role: "admin",
            preferredLanguage: null,
            lastLoginAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const req = createMockRequest();
        const res = createMockResponse();
        const next = createMockNext();

        await requireRole("admin")(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: "Forbidden: account is not active." });
        expect(next).not.toHaveBeenCalled();
    });

    // role mismatch
    it("returns 403 when user role does not match required role", async () => {
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

        await requireRole("admin")(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: "Forbidden: admin role required." });
        expect(next).not.toHaveBeenCalled();
    });

    it("calls next when user has required role", async () => {
        getAuthMock.mockReturnValue({ userId: "user_123" } as ReturnType<typeof getAuth>);
        vi.spyOn(userRepository, "findByClerkUserId").mockResolvedValue({
            clerkUserId: "user_123",
            name: "Alice",
            avatarUrl: null,
            status: "active",
            role: "admin",
            preferredLanguage: null,
            lastLoginAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const req = createMockRequest();
        const res = createMockResponse();
        const next = createMockNext();

        await requireRole("admin")(req, res, next);

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

        await requireRole("admin")(req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: "Failed to authorize role." });
        expect(next).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});
