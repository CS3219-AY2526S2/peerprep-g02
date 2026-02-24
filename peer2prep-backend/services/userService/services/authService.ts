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
                lastLoginAt: new Date(),
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
}
