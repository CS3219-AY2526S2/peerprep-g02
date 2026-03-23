import { randomUUID } from "node:crypto";
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

    // fetch user profile and sync (also handles new user creation)
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
                        score: user.score,
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

            if (localUser.role === "super_user") {
                throw new ServiceError(403, "Forbidden: super user account cannot be deleted.");
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

    async updateUserRoleForAdmin(
        actorClerkUserId: string,
        targetClerkUserId: string,
        role: Exclude<UserRole, "super_user">,
    ): Promise<AuthResponse> {
        if (!actorClerkUserId) {
            throw new ServiceError(400, "actorClerkUserId is required.");
        }

        if (!targetClerkUserId) {
            throw new ServiceError(400, "targetClerkUserId is required.");
        }

        if (role !== "user" && role !== "admin") {
            throw new ServiceError(400, "Invalid role update.");
        }

        try {
            const existingUser = await userRepository.findByClerkUserId(targetClerkUserId);
            if (!existingUser) {
                throw new ServiceError(404, "User not found.");
            }

            if (existingUser.status === "deleted") {
                throw new ServiceError(400, "Cannot update role for a deleted user.");
            }

            if (existingUser.role === "super_user") {
                throw new ServiceError(403, "Forbidden: super user role cannot be changed.");
            }

            const updatedUser = await userRepository.updateRoleByClerkUserId(
                targetClerkUserId,
                role,
            );
            if (!updatedUser) {
                throw new ServiceError(404, "User not found.");
            }

            if (existingUser.role !== role) {
                await userRepository.insertAdminAuditLog({
                    id: randomUUID(),
                    actorUserId: actorClerkUserId,
                    action: role === "admin" ? "PROMOTE_USER" : "DEMOTE_USER",
                    targetUserId: targetClerkUserId,
                    metadata: {
                        oldRole: existingUser.role,
                        newRole: role,
                    },
                });
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
        actorClerkUserId: string,
        targetClerkUserId: string,
        status: "active" | "suspended",
    ): Promise<AuthResponse> {
        if (!actorClerkUserId) {
            throw new ServiceError(400, "actorClerkUserId is required.");
        }

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

            if (existingUser.role === "super_user" && existingUser.status !== status) {
                throw new ServiceError(403, "Forbidden: super user status cannot be changed.");
            }

            const updatedUser = await userRepository.updateStatusByClerkUserId(
                targetClerkUserId,
                status,
            );
            if (!updatedUser) {
                throw new ServiceError(404, "User not found.");
            }

            if (existingUser.status !== status) {
                await userRepository.insertAdminAuditLog({
                    id: randomUUID(),
                    actorUserId: actorClerkUserId,
                    action: status === "suspended" ? "SUSPEND_USER" : "UNSUSPEND_USER",
                    targetUserId: targetClerkUserId,
                    metadata: {
                        oldStatus: existingUser.status,
                        newStatus: status,
                    },
                });
            }

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
