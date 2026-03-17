import { Request, Response } from "express";
import { UserRecord, userRepository } from "../models/User.js";

type InternalAuthzContextResponse = {
    data: {
        clerkUserId: string;
        role?: string;
        status?: string;
    };
};

type InternalAuthzBatchResponse = {
    data: {
        users: Array<{
            clerkUserId: string;
            role: string;
            status: string;
        }>;
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
     * /v1/api/users/internal/authz/context/batch:
     *   post:
     *     summary: Get internal authorization context for a batch of users.
     *     description: Requires internal service key and accepts user IDs in the request body.
     *     security:
     *       - internalServiceKey: []
     */
    async authorizeContextBatch(req: Request, res: Response): Promise<Response> {
        const userIds = req.body?.userIds;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                error: "userIds must be a non-empty array.",
            });
        }

        const normalizedUserIds = userIds.map((userId) =>
            typeof userId === "string" ? userId.trim() : "",
        );

        if (normalizedUserIds.some((userId) => userId.length === 0)) {
            return res.status(400).json({
                error: "userIds must contain only non-empty strings.",
            });
        }

        const users = await userRepository.findByClerkUserIds(
            Array.from(new Set(normalizedUserIds)),
        );

        const response: InternalAuthzBatchResponse = {
            data: {
                users: users.map((user) => ({
                    clerkUserId: user.clerkUserId,
                    role: user.role,
                    status: user.status,
                })),
            },
        };

        return res.status(200).json(response);
    }

}
