import { AuthResponse } from "../types/auth.js";
import { userRepository } from "../models/User.js";
import { ClerkService } from "./clerkService.js";
import { ServiceError, toServiceError } from "../utils/ResponseHelpers.js";

export class AuthService {
    private readonly clerkService = new ClerkService();

    // fetch user profile and sync
    async me(clerkUserId: string): Promise<AuthResponse> {
        if (!clerkUserId) {
            throw new ServiceError(400, "clerkUserId is required.");
        }

        try {
            // fetch from clerk and upsert to local DB
            const clerkUser = await this.clerkService.getUserByClerkUserId(clerkUserId);
            const user = await userRepository.upsertFromClerk({
                clerkUserId: clerkUser.clerkUserId,
                name: clerkUser.name,
                avatarUrl: clerkUser.avatarUrl,
                preferredLanguage: clerkUser.preferredLanguage,
                lastLoginAt: clerkUser.lastSignInAt || new Date(),
            });

            return {
                message: "User profile fetched successfully.",
                data: {
                    user: {
                        clerkUserId: user.clerkUserId,
                        name: user.name,
                        email: clerkUser.email,
                        status: user.status,
                        role: user.role,
                        avatarUrl: user.avatarUrl,
                        preferredLanguage: user.preferredLanguage,
                        lastLoginAt: user.lastLoginAt,
                    },
                },
            };
        } catch (error) {
            throw toServiceError(error, "Failed to fetch user profile.");
        }
    }

    async deleteAccount(clerkUserId: string): Promise<AuthResponse> {
        if (!clerkUserId) {
            throw new ServiceError(400, "clerkUserId is required.");
        }

        try {
            const localUser = await userRepository.findByClerkUserId(clerkUserId);
            if (!localUser) {
                throw new ServiceError(403, "Forbidden: local user not found.");
            }

            if (localUser.status !== "active") {
                throw new ServiceError(403, "Forbidden: account is not active.");
            }

            if (localUser.role === "admin") {
                const activeAdminCount = await userRepository.countActiveAdmins();
                if (activeAdminCount <= 1) {
                    throw new ServiceError(
                        409,
                        "Cannot delete account: at least one active admin must remain.",
                    );
                }
            }

            await this.clerkService.deleteUserByClerkUserId(clerkUserId);
            await userRepository.markDeletedByClerkUserId(clerkUserId);

            return {
                message: "Account deleted successfully.",
            };
        } catch (error) {
            if (error instanceof ServiceError) {
                throw error;
            }

            throw toServiceError(error, "Failed to delete account.");
        }
    }
}
