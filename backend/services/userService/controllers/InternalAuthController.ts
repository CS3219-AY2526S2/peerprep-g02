import { Request, Response } from "express";
import { UserRecord } from "@/models/User.js";

type InternalAuthzContextResponse = {
    data: {
        clerkUserId: string;
        role?: string;
        status?: string;
    };
};

export class InternalAuthController {
    private static buildContextResponse(
        clerkUserId: string,
        user?: UserRecord,
    ): InternalAuthzContextResponse {
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
     * /users/internal/authz/context:
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
}
