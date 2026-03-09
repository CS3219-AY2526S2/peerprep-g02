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

    const { session, created, conflict } = sessionStore.createOrGetSession(validationResult.value!);

    if (conflict) {
        return res.status(409).json({
            error: "ACTIVE_SESSION_CONFLICT",
            message:
                "An active session already exists for this user pair with different difficulty, language, or topic.",
            session,
        });
    }

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
