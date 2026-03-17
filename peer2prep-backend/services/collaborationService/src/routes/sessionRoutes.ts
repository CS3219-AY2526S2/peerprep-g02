/** Exposes REST endpoints for creating and joining collaboration sessions. */
import { Router } from "express";

import { CreateSessionErrorCode, JoinSessionErrorCode } from "@/models/models.js";
import { SessionCreationError, SessionJoinError } from "@/services/errors.js";
import { sessionJoinService } from "@/services/sessionJoinService.js";
import { sessionService } from "@/services/sessionService.js";
import { logger } from "@/utils/logger.js";
import {
    validateCreateSessionPayload,
    validateJoinSessionRequest,
} from "@/validators/validator.js";

const router = Router();

/**
 * @swagger
 * /v1/api/sessions:
 *   post:
 *     summary: Create or reuse a collaboration session for a matched user pair.
 *     description: Validates the request, verifies both users through User Service, fetches a question, and creates an active session.
 *     tags:
 *       - Collaboration Sessions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userAId
 *               - userBId
 *               - difficulty
 *               - language
 *               - topic
 *             properties:
 *               userAId:
 *                 type: string
 *               userBId:
 *                 type: string
 *               difficulty:
 *                 type: string
 *                 enum: [Easy, Medium, Hard]
 *               language:
 *                 type: string
 *               topic:
 *                 type: string
 *     responses:
 *       201:
 *         description: Session created successfully.
 *       200:
 *         description: Existing active session returned due to idempotent request.
 *       400:
 *         description: Invalid request payload.
 *       403:
 *         description: One or both matched users are not authorized for session creation.
 *       424:
 *         description: A required downstream service is unavailable.
 */
router.post("/sessions", async (req, res) => {
    const validationResult = validateCreateSessionPayload(req.body);

    if (!validationResult.valid) {
        return res.status(400).json({
            error: CreateSessionErrorCode.INVALID_SESSION_REQUEST,
            message: validationResult.error,
        });
    }

    try {
        const result = await sessionService.createSession(validationResult.value);

        logger.info(
            {
                sessionId: result.session.sessionId,
                userAId: result.session.userAId,
                userBId: result.session.userBId,
                idempotentHit: result.idempotentHit,
            },
            "Processed session creation request",
        );

        return res.status(result.idempotentHit ? 200 : 201).json(result);
    } catch (error) {
        if (error instanceof SessionCreationError) {
            return res.status(error.statusCode).json({
                error: error.code,
                message: error.message,
            });
        }

        logger.error({ err: error }, "Unexpected error while creating session");
        return res.status(500).json({
            error: CreateSessionErrorCode.SERVICE_DEPENDENCY_ERROR,
            message: "Unexpected error while creating collaboration session.",
        });
    }
});

/**
 * @swagger
 * /v1/api/sessions/{sessionId}/join:
 *   post:
 *     summary: Join an existing collaboration session.
 *     description: Allows an authenticated assigned user to join an active session and returns current participant presence information.
 *     tags:
 *       - Collaboration Sessions
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - clerkAuth: []
 *     responses:
 *       200:
 *         description: Session joined successfully.
 *       400:
 *         description: Invalid join request.
 *       403:
 *         description: User is not authenticated or not assigned to the session.
 *       404:
 *         description: Session not found.
 *       409:
 *         description: Session is not active.
 *       424:
 *         description: A required downstream service is unavailable.
 */
router.post("/sessions/:sessionId/join", async (req, res) => {
    const validationResult = validateJoinSessionRequest({
        sessionId: req.params.sessionId,
    });

    if (!validationResult.valid) {
        return res.status(400).json({
            error: JoinSessionErrorCode.INVALID_JOIN_REQUEST,
            message: validationResult.error,
        });
    }

    try {
        const result = await sessionJoinService.joinSession(
            validationResult.value.sessionId,
            req.headers.authorization ?? "",
        );

        return res.status(200).json(result);
    } catch (error) {
        if (error instanceof SessionJoinError) {
            return res.status(error.statusCode).json({
                error: error.code,
                message: error.message,
            });
        }

        logger.error({ err: error }, "Unexpected error while joining session");
        return res.status(500).json({
            error: JoinSessionErrorCode.SERVICE_DEPENDENCY_ERROR,
            message: "Unexpected error while joining collaboration session.",
        });
    }
});

export default router;
