import { Router } from "express";

import type { CreateSessionRequest } from "@/models/model.js";
import { requireInternalAuth } from "@/middlewares/requireInternalAuth.js";
import { createSession } from "@/services/sessionCreationService.js";
import { joinSession } from "@/services/sessionJoinService.js";
import { validateCreateSessionPayload } from "@/services/validation.js";
import { logger } from "@/utils/logger.js";

const router = Router();

router.post("/sessions", requireInternalAuth, async (req, res) => {
    const validationResult = validateCreateSessionPayload(req.body);

    if (!validationResult.valid) {
        return res.status(400).json({
            error: "INVALID_SESSION_REQUEST",
            message: validationResult.error,
        });
    }

    const payload = validationResult.value as CreateSessionRequest;
    const result = await createSession(payload);

    if (!result.ok) {
        const responseBody: Record<string, unknown> = {
            error: result.error,
            message: result.message,
        };

        if ("failedUserIds" in result) {
            responseBody.failedUserIds = result.failedUserIds;
        }

        return res.status(result.statusCode).json(responseBody);
    }

    logger.info(
        {
            sessionId: result.session.sessionId,
            userAId: result.session.userAId,
            userBId: result.session.userBId,
            created: result.created,
            cacheStored: result.cacheStored,
        },
        "Processed session creation request",
    );

    return res.status(result.created ? 201 : 200).json({
        session: result.session,
        idempotentHit: !result.created,
        cacheStored: result.cacheStored,
    });
});

router.post("/sessions/:sessionId/join", async (req, res) => {
    const result = await joinSession(req.params.sessionId, req.header("authorization"));

    if (!result.ok) {
        return res.status(result.statusCode).json({
            error: result.error,
            message: result.message,
        });
    }

    return res.status(200).json({
        session: result.session,
    });
});

export default router;
