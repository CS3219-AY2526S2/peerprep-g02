import type { Request, Response } from "express";

import { userRepository } from "../models/User.js";

type BatchValidationRequest = {
    userIds?: string[];
};

export class InternalUserValidationController {
    async validateUsers(req: Request, res: Response): Promise<Response> {
        const body = req.body as BatchValidationRequest | undefined;
        const userIds = Array.isArray(body?.userIds)
            ? body.userIds.filter(
                  (value): value is string => typeof value === "string" && value.trim().length > 0,
              )
            : [];

        if (userIds.length === 0) {
            return res.status(400).json({
                error: "userIds must be a non-empty array of strings.",
            });
        }

        const uniqueUserIds = [...new Set(userIds.map((userId) => userId.trim()))];
        const users = await Promise.all(
            uniqueUserIds.map(async (userId) => {
                const user = await userRepository.findByClerkUserId(userId);

                return {
                    userId,
                    status: user?.status ?? "unknown",
                };
            }),
        );

        return res.status(200).json({
            data: {
                users,
            },
        });
    }
}
