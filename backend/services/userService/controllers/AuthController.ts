import { Request, Response } from "express";
import { getAuth } from "@clerk/express";

import { AuthService } from "../services/authService.js";
import { badRequest, handleError } from "../utils/ResponseHelpers.js";

export class AuthController {
    private readonly authService = new AuthService();

    /**
     * @swagger
     * /users/me:
     *   get:
     *     summary: Get authenticated user profile and sync local user record.
     */
    async me(req: Request, res: Response): Promise<Response | void> {
        const { userId } = getAuth(req);

        if (!userId) {
            return badRequest(res, "Authenticated userId is required.");
        }

        try {
            const result = await this.authService.me(userId);
            return res.status(200).json(result);
        } catch (error) {
            handleError(res, error, "fetch me");
        }
    }

    /**
     * @swagger
     * /users/me:
     *   delete:
     *     summary: Delete authenticated user's account with admin-safety checks.
     */
    async deleteAccount(req: Request, res: Response): Promise<Response | void> {
        const { userId } = getAuth(req);

        if (!userId) {
            return badRequest(res, "Authenticated userId is required.");
        }

        try {
            const result = await this.authService.deleteAccount(userId);
            return res.status(200).json(result);
        } catch (error) {
            handleError(res, error, "delete account");
        }
    }

    /**
     * @swagger
     * /users/admin/users:
     *   get:
     *     summary: Get all active and suspended users for admin management.
     */
    async listUsers(req: Request, res: Response): Promise<Response | void> {
        const { userId } = getAuth(req);

        if (!userId) {
            return badRequest(res, "Authenticated userId is required.");
        }

        try {
            const result = await this.authService.listUsersForAdmin();
            return res.status(200).json(result);
        } catch (error) {
            handleError(res, error, "fetch admin users");
        }
    }

    /**
     * @swagger
     * /users/admin/users/{clerkUserId}/role:
     *   patch:
     *     summary: Promote or demote user role.
     */
    async updateUserRole(req: Request, res: Response): Promise<Response | void> {
        const { userId } = getAuth(req);
        const { clerkUserId } = req.params;
        const role = req.body?.role as "user" | "admin" | undefined;

        if (!userId) {
            return badRequest(res, "Authenticated userId is required.");
        }

        if (!clerkUserId) {
            return badRequest(res, "Target clerkUserId is required.");
        }

        if (role !== "user" && role !== "admin") {
            return badRequest(res, "role must be either 'user' or 'admin'.");
        }

        try {
            const result = await this.authService.updateUserRoleForAdmin(
                userId,
                clerkUserId,
                role,
            );
            return res.status(200).json(result);
        } catch (error) {
            handleError(res, error, "update user role");
        }
    }

    /**
     * @swagger
     * /users/admin/users/{clerkUserId}/status:
     *   patch:
     *     summary: Suspend or unsuspend user account.
     */
    async updateUserStatus(req: Request, res: Response): Promise<Response | void> {
        const { userId } = getAuth(req);
        const { clerkUserId } = req.params;
        const status = req.body?.status as "active" | "suspended" | undefined;

        if (!userId) {
            return badRequest(res, "Authenticated userId is required.");
        }

        if (!clerkUserId) {
            return badRequest(res, "Target clerkUserId is required.");
        }

        if (status !== "active" && status !== "suspended") {
            return badRequest(res, "status must be either 'active' or 'suspended'.");
        }

        try {
            const result = await this.authService.updateUserStatusForAdmin(
                userId,
                clerkUserId,
                status,
            );
            return res.status(200).json(result);
        } catch (error) {
            handleError(res, error, "update user status");
        }
    }
}
