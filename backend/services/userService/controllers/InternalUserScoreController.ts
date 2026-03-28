import type { Request, Response } from "express";

import { userRepository } from "@/models/User.js";
import { handleError } from "@/utils/ResponseHelpers.js";

type ScoreUpdateRequest = {
    score?: number;
};

type ScoreDeltaUpdateRequest = {
    updates?: Array<{
        clerkUserId?: string;
        delta?: number;
    }>;
};

export class InternalUserScoreController {
    async getScore(req: Request, res: Response): Promise<Response> {
        try {
            const clerkUserId = req.params.clerkUserId?.trim();

            if (!clerkUserId) {
                return res.status(400).json({
                    error: "clerkUserId is required.",
                });
            }

            const user = await userRepository.findByClerkUserId(clerkUserId);
            if (!user) {
                return res.status(404).json({
                    error: "User not found.",
                });
            }

            return res.status(200).json({
                data: {
                    user: {
                        clerkUserId: user.clerkUserId,
                        score: user.score,
                    },
                },
            });
        } catch (error) {
            handleError(res, error, "fetch internal user score");
            return res;
        }
    }

    async updateScore(req: Request, res: Response): Promise<Response> {
        try {
            const clerkUserId = req.params.clerkUserId?.trim();
            const body = req.body as ScoreUpdateRequest | undefined;

            if (!clerkUserId) {
                return res.status(400).json({
                    error: "clerkUserId is required.",
                });
            }

            const score = body?.score;

            if (!Number.isInteger(score) || (score ?? -1) < 0) {
                return res.status(400).json({
                    error: "score must be a non-negative integer.",
                });
            }

            const updatedUser = await userRepository.updateScoreByClerkUserId(
                clerkUserId,
                score as number,
            );

            if (!updatedUser) {
                return res.status(404).json({
                    error: "User not found.",
                });
            }

            return res.status(200).json({
                message: "User score updated successfully.",
                data: {
                    user: {
                        clerkUserId: updatedUser.clerkUserId,
                        score: updatedUser.score,
                    },
                },
            });
        } catch (error) {
            handleError(res, error, "update internal user score");
            return res;
        }
    }

    async applyScoreDeltas(req: Request, res: Response): Promise<Response> {
        try {
            const body = req.body as ScoreDeltaUpdateRequest | undefined;
            const updates = body?.updates;

            if (!Array.isArray(updates) || updates.length === 0) {
                return res.status(400).json({
                    error: "updates must be a non-empty array.",
                });
            }

            const normalizedUpdates = updates.map((update) => ({
                clerkUserId: update.clerkUserId?.trim() ?? "",
                delta: update.delta,
            }));

            if (
                normalizedUpdates.some(
                    (update) =>
                        update.clerkUserId.length === 0 ||
                        !Number.isInteger(update.delta),
                )
            ) {
                return res.status(400).json({
                    error: "Each update must include clerkUserId and an integer delta.",
                });
            }

            const scoreUpdates = await userRepository.applyScoreDeltas(
                normalizedUpdates as Array<{ clerkUserId: string; delta: number }>,
            );

            return res.status(200).json({
                message: "User scores updated successfully.",
                data: {
                    updates: scoreUpdates,
                },
            });
        } catch (error) {
            handleError(res, error, "apply internal user score deltas");
            return res;
        }
    }
}
