import { AuthResponse } from "../types/auth.js";
import { UserRole, userRepository } from "../models/User.js";
import { ClerkService } from "./clerkService.js";
import { ServiceError, toServiceError } from "../utils/ResponseHelpers.js";
import { logger } from "../utils/logger.js";

export class AuthService {
    private readonly clerkService = new ClerkService();

    private syncClerkSuspensionState(clerkUserId: string, status: "active" | "suspended"): void {
        void (async () => {
            try {
                if (status === "suspended") {
                    await this.clerkService.banUserByClerkUserId(clerkUserId);
                    await this.clerkService.revokeActiveSessionsByClerkUserId(clerkUserId);
                    return;
                }

                await this.clerkService.unbanUserByClerkUserId(clerkUserId);
            } catch (error) {
                logger.error(
                    { err: error, clerkUserId, status },
                    "Failed to sync Clerk suspension state",
                );
            }
        })();
    }

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

    async listUsersForAdmin(): Promise<AuthResponse> {
        try {
            const users = await userRepository.listByStatuses(["active", "suspended"]);
            const clerkUsers = await this.clerkService.getUsersByClerkUserIds(
                users.map((user) => user.clerkUserId),
            );

            return {
                message: "Users fetched successfully.",
                data: {
                    users: users.map((user) => {
                        const clerkUser = clerkUsers.get(user.clerkUserId);
                        return {
                            clerkUserId: user.clerkUserId,
                            name: user.name,
                            email: clerkUser?.email || "",
                            role: user.role,
                            status: user.status,
                        };
                    }),
                },
            };
        } catch (error) {
            throw toServiceError(error, "Failed to fetch users.");
        }
    }

    async updateUserRoleForAdmin(targetClerkUserId: string, role: UserRole): Promise<AuthResponse> {
        if (!targetClerkUserId) {
            throw new ServiceError(400, "targetClerkUserId is required.");
        }

        try {
            const existingUser = await userRepository.findByClerkUserId(targetClerkUserId);
            if (!existingUser) {
                throw new ServiceError(404, "User not found.");
            }

            if (existingUser.status === "deleted") {
                throw new ServiceError(400, "Cannot update role for a deleted user.");
            }

            if (
                existingUser.role === "admin" &&
                role === "user" &&
                existingUser.status === "active"
            ) {
                const activeAdminCount = await userRepository.countActiveAdmins();
                if (activeAdminCount <= 1) {
                    throw new ServiceError(
                        409,
                        "Cannot demote user: at least one active admin must remain.",
                    );
                }
            }

            const updatedUser = await userRepository.updateRoleByClerkUserId(
                targetClerkUserId,
                role,
            );
            if (!updatedUser) {
                throw new ServiceError(404, "User not found.");
            }

            return {
                message: "User role updated successfully.",
                data: {
                    user: {
                        clerkUserId: updatedUser.clerkUserId,
                        name: updatedUser.name,
                        role: updatedUser.role,
                        status: updatedUser.status,
                    },
                },
            };
        } catch (error) {
            if (error instanceof ServiceError) {
                throw error;
            }

            throw toServiceError(error, "Failed to update user role.");
        }
    }

    async updateUserStatusForAdmin(
        targetClerkUserId: string,
        status: "active" | "suspended",
    ): Promise<AuthResponse> {
        if (!targetClerkUserId) {
            throw new ServiceError(400, "targetClerkUserId is required.");
        }

        try {
            const existingUser = await userRepository.findByClerkUserId(targetClerkUserId);
            if (!existingUser) {
                throw new ServiceError(404, "User not found.");
            }

            if (existingUser.status === "deleted") {
                throw new ServiceError(400, "Cannot update status for a deleted user.");
            }

            if (
                existingUser.role === "admin" &&
                existingUser.status === "active" &&
                status === "suspended"
            ) {
                const activeAdminCount = await userRepository.countActiveAdmins();
                if (activeAdminCount <= 1) {
                    throw new ServiceError(
                        409,
                        "Cannot suspend user: at least one active admin must remain.",
                    );
                }
            }

            const updatedUser = await userRepository.updateStatusByClerkUserId(
                targetClerkUserId,
                status,
            );
            if (!updatedUser) {
                throw new ServiceError(404, "User not found.");
            }

            // Non-blocking identity-layer sync to avoid slowing the admin action response path.
            this.syncClerkSuspensionState(targetClerkUserId, status);

            return {
                message: "User status updated successfully.",
                data: {
                    user: {
                        clerkUserId: updatedUser.clerkUserId,
                        name: updatedUser.name,
                        role: updatedUser.role,
                        status: updatedUser.status,
                    },
                },
            };
        } catch (error) {
            if (error instanceof ServiceError) {
                throw error;
            }

            throw toServiceError(error, "Failed to update user status.");
        }
    }
}
