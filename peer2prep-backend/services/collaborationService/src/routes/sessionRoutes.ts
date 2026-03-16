import { Router } from "express";

import type { CreateSessionRequest } from "@/models/model.js";
import { verifyMatch } from "@/services/matchingService.js";
import { sessionStore } from "@/services/sessionStore.js";
import {
    fetchAuthenticatedUserContext,
    verifyUsersAuthentication,
} from "@/services/userAuthService.js";
import { validateCreateSessionPayload } from "@/services/validation.js";
import { logger } from "@/utils/logger.js";

const router = Router();

router.post("/sessions", async (req, res) => {
    const validationResult = validateCreateSessionPayload(req.body);

    if (!validationResult.valid) {
        return res.status(400).json({
            error: "INVALID_SESSION_REQUEST",
            message: validationResult.error,
        });
    }

    const authHeader = req.header("authorization");
    const authContext = await fetchAuthenticatedUserContext(authHeader);

    if (!authContext.ok) {
        if (authContext.reason === "unauthenticated") {
            return res.status(401).json({
                error: "UNAUTHORIZED",
                message: "A valid authenticated user is required to create a session.",
            });
        }

        return res.status(502).json({
            error: "USER_SERVICE_UNAVAILABLE",
            message: authContext.message,
        });
    }

    const payload = validationResult.value as CreateSessionRequest;
    const matchResult = await verifyMatch(payload.matchId);

    if (!matchResult.valid) {
        if (matchResult.errorType === "MATCH_NOT_FOUND") {
            return res.status(404).json({
                error: "MATCH_NOT_FOUND",
                message: "No active match handoff was found for the provided matchId.",
            });
        }

        return res.status(502).json({
            error: "MATCHING_SERVICE_UNAVAILABLE",
            message: matchResult.message,
        });
    }

    const { match } = matchResult;
    if (authContext.userId !== match.userId && authContext.userId !== match.partnerId) {
        return res.status(403).json({
            error: "FORBIDDEN_MATCH_ACCESS",
            message: "Authenticated user is not part of the provided match.",
        });
    }

    const usersAuthResult = await verifyUsersAuthentication([match.userId, match.partnerId]);
    if (!usersAuthResult.valid) {
        if (usersAuthResult.errorType === "AUTHENTICATION_FAILED") {
            return res.status(403).json({
                error: "MATCH_USERS_NOT_ACTIVE",
                message: "One or more matched users are not active.",
                failedUserIds: usersAuthResult.failedUserIds,
            });
        }

        return res.status(502).json({
            error: "USER_SERVICE_UNAVAILABLE",
            message: usersAuthResult.message,
        });
    }

    const { session, created, conflict } = sessionStore.createOrGetSession({
        matchId: match.matchId,
        userAId: match.userId,
        userBId: match.partnerId,
        difficulty: match.matchedDifficulty,
        language: match.matchedLanguage,
        topic: match.matchedTopic,
    });

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
