import { Router } from "express";

import { ERROR_CODES, HTTP_STATUS } from "@/config/constants.js";
import { collaborationSessionService } from "@/services/collaborationSessionService.js";
import { validateCreateSessionPayload } from "@/services/validation.js";
import { logger } from "@/utils/logger.js";

const router = Router();

router.post("/sessions", async (req, res, next) => {
    const validationResult = validateCreateSessionPayload(req.body);

    if (!validationResult.valid) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: ERROR_CODES.INVALID_SESSION_REQUEST,
            message: validationResult.error,
        });
    }

    try {
        const result = await collaborationSessionService.createSession(validationResult.value);

        logger.info(
            {
                collaborationId: result.session.collaborationId,
                userAId: result.session.userAId,
                userBId: result.session.userBId,
                questionId: result.session.questionId,
                idempotentHit: result.idempotentHit,
                cacheWriteSucceeded: result.cacheWriteSucceeded,
            },
            "Processed collaboration session creation request",
        );

        return res.status(result.idempotentHit ? HTTP_STATUS.OK : HTTP_STATUS.CREATED).json({
            session: result.session,
            idempotentHit: result.idempotentHit,
            cacheWriteSucceeded: result.cacheWriteSucceeded,
        });
    } catch (error) {
        next(error);
    }
});

export default router;
