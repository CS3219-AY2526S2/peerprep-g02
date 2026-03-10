import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthService } from "../../services/authService.js";
import { userRepository } from "../../models/User.js";
import { ClerkService } from "../../services/clerkService.js";
import { ServiceError } from "../../utils/ResponseHelpers.js";

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

    it("rejects deleting the last active admin", async () => {
        vi.spyOn(userRepository, "findByClerkUserId").mockResolvedValue({
            clerkUserId: "admin_1",
            name: "Admin",
            avatarUrl: null,
            status: "active",
            role: "admin",
            preferredLanguage: null,
            lastLoginAt: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        });
        vi.spyOn(userRepository, "countActiveAdmins").mockResolvedValue(1);
        const deleteClerkSpy = vi
            .spyOn(ClerkService.prototype, "deleteUserByClerkUserId")
            .mockResolvedValue();

        const service = new AuthService();
        await expect(service.deleteAccount("admin_1")).rejects.toMatchObject({
            statusCode: 409,
            message: "Cannot delete account: at least one active admin must remain.",
        });

        expect(deleteClerkSpy).not.toHaveBeenCalled();
    });

    it("allows admin deletion when another active admin exists", async () => {
        vi.spyOn(userRepository, "findByClerkUserId").mockResolvedValue({
            clerkUserId: "admin_1",
            name: "Admin",
            avatarUrl: null,
            status: "active",
            role: "admin",
            preferredLanguage: null,
            lastLoginAt: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        });
        vi.spyOn(userRepository, "countActiveAdmins").mockResolvedValue(2);
        const deleteClerkSpy = vi
            .spyOn(ClerkService.prototype, "deleteUserByClerkUserId")
            .mockResolvedValue();
        const markDeletedSpy = vi
            .spyOn(userRepository, "markDeletedByClerkUserId")
            .mockResolvedValue();

        const service = new AuthService();
        const result = await service.deleteAccount("admin_1");

        expect(deleteClerkSpy).toHaveBeenCalledWith("admin_1");
        expect(markDeletedSpy).toHaveBeenCalledWith("admin_1");
        expect(result).toEqual({ message: "Account deleted successfully." });
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

    it("updates user status for admin actions", async () => {
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

        const service = new AuthService();
        const result = await service.updateUserStatusForAdmin("user_1", "suspended");

        expect(result).toMatchObject({
            message: "User status updated successfully.",
            data: {
                user: {
                    clerkUserId: "user_1",
                    status: "suspended",
                },
            },
        });
    });
});
