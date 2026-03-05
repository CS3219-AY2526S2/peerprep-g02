import { Router } from "express";

import { sessionStore } from "@/services/sessionStore.js";
import { validateCreateSessionPayload } from "@/services/validation.js";
import { logger } from "@/utils/logger.js";

const router = Router();

router.post("/sessions", (req, res) => {
    const validationResult = validateCreateSessionPayload(req.body);

    if (!validationResult.valid) {
        return res.status(400).json({
            error: "INVALID_SESSION_REQUEST",
            message: validationResult.error,
        });
    }

    const payload = validationResult.value;
    const result = sessionStore.createOrGetSession(payload);

    if ("conflict" in result) {
        logger.warn(
            {
                sessionId: result.existingSession.sessionId,
                userAId: result.existingSession.userAId,
                userBId: result.existingSession.userBId,
                existingDifficulty: result.existingSession.difficulty,
                existingLanguage: result.existingSession.language,
                requestedDifficulty: payload.difficulty,
                requestedLanguage: payload.language,
            },
            "Session conflict: active session exists with different parameters",
        );
        return res.status(409).json({
            error: "SESSION_CONFLICT",
            message:
                "An active session already exists for this user pair with different difficulty or language.",
            existingSession: result.existingSession,
        });
    }

    const { session, created } = result;
    logger.info(
        {
            sessionId: session.sessionId,
            userAId: session.userAId,
            userBId: session.userBId,
            created,
        },
        "Processed session creation request",
    );

    return res.status(created ? 201 : 200).json({
        session,
        idempotentHit: !created,
    });
});

export default router;
