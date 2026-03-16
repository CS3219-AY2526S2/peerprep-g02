import { Request, Response } from "express";
import { UserRecord, userRepository } from "../models/User.js";

type InternalAuthzContextResponse = {
    data: {
        clerkUserId: string;
        role?: string;
        status?: string;
    };
};

export class InternalAuthController {
    private static buildContextResponse(clerkUserId: string, user?: UserRecord): InternalAuthzContextResponse {
        return {
            data: {
                clerkUserId,
                role: user?.role,
                status: user?.status,
            },
        };
    }

    /**
     * @swagger
     * /v1/api/users/internal/authz/context:
     *   get:
     *     summary: Get internal authorization context for the authenticated user.
     *     description: Requires internal service key and a valid Clerk bearer token.
     *     security:
     *       - clerkAuth: []
     *         internalServiceKey: []
     */
    authorizeContext(_req: Request, res: Response): Response {
        const clerkUserId = res.locals.clerkUserId as string | undefined;
        const user = res.locals.authUser as UserRecord | undefined;

        if (!clerkUserId) {
            return res.status(500).json({ error: "Authenticated user context is missing." });
        }

        return res.status(200).json(InternalAuthController.buildContextResponse(clerkUserId, user));
    }

    /**
     * @swagger
     * /v1/api/users/internal/authz/users/{userId}/status:
     *   get:
     *     summary: Get internal status for a user by Clerk user ID.
     *     description: Requires the internal service key.
     *     security:
     *       - internalServiceKey: []
     */
    async getUserStatus(req: Request, res: Response): Promise<Response> {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ error: "userId is required." });
        }

        const user = await userRepository.findByClerkUserId(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        return res.status(200).json(
            InternalAuthController.buildContextResponse(user.clerkUserId, user),
        );
    }

}
