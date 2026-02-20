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
            lastLoginAt: expect.any(Date),
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
});
