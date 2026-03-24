import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthService } from "../../services/authService.js";
import { userRepository } from "../../models/User.js";
import { ClerkService } from "../../services/clerkService.js";
import { ServiceError } from "../../utils/ResponseHelpers.js";
import { logger } from "../../utils/logger.js";

vi.mock("../../utils/logger.js", () => ({
    logger: {
        error: vi.fn(),
    },
}));

describe("AuthService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // no userID
    it("throws 400 when clerkUserId is empty", async () => {
        const service = new AuthService();

        await expect(service.me("")).rejects.toMatchObject({
            statusCode: 400,
            message: "clerkUserId is required.",
        });
    });

    // successful case
    it("returns profile and syncs local user on success", async () => {
        const clerkSpy = vi
            .spyOn(ClerkService.prototype, "getUserByClerkUserId")
            .mockResolvedValue({
                clerkUserId: "user_123",
                email: "alice@example.com",
                name: "Alice Tan",
                avatarUrl: "https://cdn.example.com/alice.png",
                preferredLanguage: "Python",
                lastSignInAt: new Date("2026-01-01T00:00:00.000Z"),
            });

        const upsertSpy = vi.spyOn(userRepository, "upsertFromClerk").mockResolvedValue({
            clerkUserId: "user_123",
            name: "Alice Tan",
            avatarUrl: null,
            status: "active",
            role: "user",
            preferredLanguage: null,
            lastLoginAt: new Date("2026-01-01T00:00:00.000Z"),
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        });

        const service = new AuthService();
        const result = await service.me("user_123");

        expect(clerkSpy).toHaveBeenCalledWith("user_123");
        expect(upsertSpy).toHaveBeenCalledWith({
            clerkUserId: "user_123",
            name: "Alice Tan",
            avatarUrl: "https://cdn.example.com/alice.png",
            preferredLanguage: "Python",
            lastLoginAt: new Date("2026-01-01T00:00:00.000Z"),
        });

        expect(result).toMatchObject({
            message: "User profile fetched successfully.",
            data: {
                user: {
                    clerkUserId: "user_123",
                    name: "Alice Tan",
                    email: "alice@example.com",
                    role: "user",
                    status: "active",
                },
            },
        });
    });

    // error mapping
    it("maps Clerk-style errors into ServiceError", async () => {
        vi.spyOn(ClerkService.prototype, "getUserByClerkUserId").mockRejectedValue({
            clerkError: true,
            status: 422,
            errors: [{ message: "Unprocessable entity from Clerk" }],
        });

        const service = new AuthService();
        const request = service.me("user_123");

        await request.catch((error) => {
            expect(error).toBeInstanceOf(ServiceError);
            expect(error).toMatchObject({
                statusCode: 422,
                message: "Unprocessable entity from Clerk",
            });
        });
    });

    it("deletes a normal user account successfully", async () => {
        vi.spyOn(userRepository, "findByClerkUserId").mockResolvedValue({
            clerkUserId: "user_123",
            name: "Alice Tan",
            avatarUrl: null,
            status: "active",
            role: "user",
            preferredLanguage: null,
            lastLoginAt: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        });
        const deleteClerkSpy = vi
            .spyOn(ClerkService.prototype, "deleteUserByClerkUserId")
            .mockResolvedValue();
        const markDeletedSpy = vi
            .spyOn(userRepository, "markDeletedByClerkUserId")
            .mockResolvedValue();

        const service = new AuthService();
        const result = await service.deleteAccount("user_123");

        expect(deleteClerkSpy).toHaveBeenCalledWith("user_123");
        expect(markDeletedSpy).toHaveBeenCalledWith("user_123");
        expect(result).toEqual({ message: "Account deleted successfully." });
    });

    it("rejects deleting a super user account", async () => {
        vi.spyOn(userRepository, "findByClerkUserId").mockResolvedValue({
            clerkUserId: "super_1",
            name: "Super User",
            avatarUrl: null,
            status: "active",
            role: "super_user",
            preferredLanguage: null,
            lastLoginAt: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        });
        const deleteClerkSpy = vi
            .spyOn(ClerkService.prototype, "deleteUserByClerkUserId")
            .mockResolvedValue();

        const service = new AuthService();
        await expect(service.deleteAccount("super_1")).rejects.toMatchObject({
            statusCode: 403,
            message: "Forbidden: super user account cannot be deleted.",
        });

        expect(deleteClerkSpy).not.toHaveBeenCalled();
    });

    it("returns admin user list with emails from Clerk", async () => {
        vi.spyOn(userRepository, "listByStatuses").mockResolvedValue([
            {
                clerkUserId: "user_1",
                name: "Alice",
                avatarUrl: null,
                status: "active",
                role: "user",
                preferredLanguage: null,
                lastLoginAt: null,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            },
        ]);
        vi.spyOn(ClerkService.prototype, "getUsersByClerkUserIds").mockResolvedValue(
            new Map([
                [
                    "user_1",
                    {
                        clerkUserId: "user_1",
                        email: "alice@example.com",
                        name: "Alice",
                        avatarUrl: null,
                        preferredLanguage: null,
                        lastSignInAt: null,
                    },
                ],
            ]),
        );

        const service = new AuthService();
        const result = await service.listUsersForAdmin();

        expect(result).toMatchObject({
            message: "Users fetched successfully.",
            data: {
                users: [
                    {
                        clerkUserId: "user_1",
                        name: "Alice",
                        email: "alice@example.com",
                        role: "user",
                        status: "active",
                    },
                ],
            },
        });
    });

    it("triggers Clerk unban when admin sets status back to active", async () => {
        vi.spyOn(userRepository, "findByClerkUserId").mockResolvedValue({
            clerkUserId: "user_1",
            name: "Alice",
            avatarUrl: null,
            status: "suspended",
            role: "user",
            preferredLanguage: null,
            lastLoginAt: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        });
        const unbanSpy = vi
            .spyOn(ClerkService.prototype, "unbanUserByClerkUserId")
            .mockResolvedValue();
        vi.spyOn(userRepository, "updateStatusByClerkUserId").mockResolvedValue({
            clerkUserId: "user_1",
            name: "Alice",
            avatarUrl: null,
            status: "active",
            role: "user",
            preferredLanguage: null,
            lastLoginAt: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        });
        const insertAuditSpy = vi.spyOn(userRepository, "insertAdminAuditLog").mockResolvedValue();

        const service = new AuthService();
        const result = await service.updateUserStatusForAdmin("admin_1", "user_1", "active");

        expect(result).toMatchObject({
            message: "User status updated successfully.",
            data: {
                user: {
                    clerkUserId: "user_1",
                    status: "active",
                },
            },
        });
        expect(insertAuditSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                actorUserId: "admin_1",
                action: "UNSUSPEND_USER",
                targetUserId: "user_1",
                metadata: {
                    oldStatus: "suspended",
                    newStatus: "active",
                },
            }),
        );
        expect(unbanSpy).toHaveBeenCalledWith("user_1");
    });

    it("rejects changing role for super user", async () => {
        vi.spyOn(userRepository, "findByClerkUserId").mockResolvedValue({
            clerkUserId: "super_1",
            name: "Super User",
            avatarUrl: null,
            status: "active",
            role: "super_user",
            preferredLanguage: null,
            lastLoginAt: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        });
        const updateRoleSpy = vi.spyOn(userRepository, "updateRoleByClerkUserId");

        const service = new AuthService();
        await expect(
            service.updateUserRoleForAdmin("admin_1", "super_1", "user"),
        ).rejects.toMatchObject({
            statusCode: 403,
            message: "Forbidden: super user role cannot be changed.",
        });

        expect(updateRoleSpy).not.toHaveBeenCalled();
    });

    it("rejects changing status for super user", async () => {
        vi.spyOn(userRepository, "findByClerkUserId").mockResolvedValue({
            clerkUserId: "super_1",
            name: "Super User",
            avatarUrl: null,
            status: "active",
            role: "super_user",
            preferredLanguage: null,
            lastLoginAt: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        });
        const updateStatusSpy = vi.spyOn(userRepository, "updateStatusByClerkUserId");

        const service = new AuthService();
        await expect(
            service.updateUserStatusForAdmin("admin_1", "super_1", "suspended"),
        ).rejects.toMatchObject({
            statusCode: 403,
            message: "Forbidden: super user status cannot be changed.",
        });

        expect(updateStatusSpy).not.toHaveBeenCalled();
    });

    it("does not fail admin status update response when Clerk sync fails", async () => {
        vi.spyOn(userRepository, "findByClerkUserId").mockResolvedValue({
            clerkUserId: "user_1",
            name: "Alice",
            avatarUrl: null,
            status: "active",
            role: "user",
            preferredLanguage: null,
            lastLoginAt: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        });
        vi.spyOn(ClerkService.prototype, "banUserByClerkUserId").mockRejectedValue(
            new Error("clerk unavailable"),
        );
        vi.spyOn(userRepository, "updateStatusByClerkUserId").mockResolvedValue({
            clerkUserId: "user_1",
            name: "Alice",
            avatarUrl: null,
            status: "suspended",
            role: "user",
            preferredLanguage: null,
            lastLoginAt: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        });
        const insertAuditSpy = vi.spyOn(userRepository, "insertAdminAuditLog").mockResolvedValue();

        const service = new AuthService();
        const result = await service.updateUserStatusForAdmin("admin_1", "user_1", "suspended");

        expect(result).toMatchObject({
            message: "User status updated successfully.",
            data: {
                user: {
                    clerkUserId: "user_1",
                    status: "suspended",
                },
            },
        });
        expect(insertAuditSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                actorUserId: "admin_1",
                action: "SUSPEND_USER",
                targetUserId: "user_1",
                metadata: {
                    oldStatus: "active",
                    newStatus: "suspended",
                },
            }),
        );
        await Promise.resolve();
        expect(logger.error).toHaveBeenCalled();
    });
});
