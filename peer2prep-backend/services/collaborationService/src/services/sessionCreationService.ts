import type { CollaborationSession, CreateSessionRequest } from "@/models/model.js";
import { sessionRepository, buildPairKey } from "@/repositories/sessionRepository.js";
import { fetchQuestionForSession } from "@/services/questionService.js";
import { sessionCache } from "@/services/sessionCache.js";
import { verifyUsersAuthentication } from "@/services/userAuthService.js";
import { sessionLogger } from "@/utils/logger.js";

type SessionCreationSuccess = {
    ok: true;
    session: CollaborationSession;
    created: boolean;
    cacheStored: boolean;
};

type SessionCreationFailure =
    | {
          ok: false;
          statusCode: 403;
          error: "MATCH_USERS_NOT_ACTIVE";
          message: string;
          failedUserIds: string[];
      }
    | {
          ok: false;
          statusCode: 502;
          error: "USER_SERVICE_UNAVAILABLE" | "QUESTION_SERVICE_UNAVAILABLE";
          message: string;
      };

export type SessionCreationResult = SessionCreationSuccess | SessionCreationFailure;

function isUniqueViolation(error: unknown): error is { code: string } {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "23505"
    );
}

export async function createSession(
    request: CreateSessionRequest,
): Promise<SessionCreationResult> {
    const usersAuthResult = await verifyUsersAuthentication([request.userAId, request.userBId]);

    if (!usersAuthResult.valid) {
        if (usersAuthResult.errorType === "AUTHENTICATION_FAILED") {
            return {
                ok: false,
                statusCode: 403,
                error: "MATCH_USERS_NOT_ACTIVE",
                message: "One or more matched users are not active.",
                failedUserIds: usersAuthResult.failedUserIds,
            };
        }

        return {
            ok: false,
            statusCode: 502,
            error: "USER_SERVICE_UNAVAILABLE",
            message: usersAuthResult.message,
        };
    }

    const pairKey = buildPairKey(request.userAId, request.userBId);
    const existingSession = await sessionRepository.findActiveByPair(pairKey);

    if (existingSession) {
        const cacheStored = await sessionCache.cacheSession(existingSession);
        return {
            ok: true,
            session: existingSession,
            created: false,
            cacheStored,
        };
    }

    const questionResult = await fetchQuestionForSession(request.topic, request.difficulty);
    if (!questionResult.ok) {
        return {
            ok: false,
            statusCode: 502,
            error: "QUESTION_SERVICE_UNAVAILABLE",
            message: questionResult.message,
        };
    }

    try {
        const session = await sessionRepository.createActiveSession(request, questionResult.questionId);
        const cacheStored = await sessionCache.cacheSession(session);
        return {
            ok: true,
            session,
            created: true,
            cacheStored,
        };
    } catch (error) {
        if (isUniqueViolation(error)) {
            sessionLogger.warn({ pairKey }, "Detected concurrent duplicate session creation request");
            const concurrentSession = await sessionRepository.findActiveByPair(pairKey);

            if (concurrentSession) {
                const cacheStored = await sessionCache.cacheSession(concurrentSession);
                return {
                    ok: true,
                    session: concurrentSession,
                    created: false,
                    cacheStored,
                };
            }
        }

        throw error;
    }
}
