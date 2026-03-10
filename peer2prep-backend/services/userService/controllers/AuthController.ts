import { Request, Response } from "express";
import { getAuth } from "@clerk/express";

import { AuthService } from "../services/authService.js";
import { badRequest, handleError } from "../utils/ResponseHelpers.js";

export class AuthController {
    private readonly authService = new AuthService();

    /**
     * @swagger
     * /v1/api/users/me:
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
     * /v1/api/users/me:
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
}
