import { Router } from "express";

import { CreateSessionErrorCode } from "@/models/models.js";
import { SessionCreationError } from "@/services/errors.js";
import { sessionService } from "@/services/sessionService.js";
import { logger } from "@/utils/logger.js";
import { validateCreateSessionPayload } from "@/validators/validator.js";

const router = Router();

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

export default router;
