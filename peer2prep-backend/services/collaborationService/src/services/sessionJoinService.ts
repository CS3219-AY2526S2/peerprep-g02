import type {
    CollaborationSession,
    SessionErrorCode,
} from "@/models/model.js";
import { SESSION_ERROR } from "@/models/model.js";
import { validateSessionAccess } from "@/services/sessionAccessService.js";
import { fetchAuthenticatedUserContext } from "@/services/userAuthService.js";

type SessionJoinSuccess = {
    ok: true;
    session: CollaborationSession;
};

type SessionJoinFailure =
    | { ok: false; statusCode: 401; error: SessionErrorCode; message: string }
    | { ok: false; statusCode: 403; error: SessionErrorCode; message: string }
    | { ok: false; statusCode: 404; error: SessionErrorCode; message: string }
    | { ok: false; statusCode: 409; error: SessionErrorCode; message: string }
    | { ok: false; statusCode: 502; error: SessionErrorCode; message: string };

export type SessionJoinResult = SessionJoinSuccess | SessionJoinFailure;

export async function joinSession(
    sessionId: string,
    authHeader: string | undefined,
): Promise<SessionJoinResult> {
    const authContext = await fetchAuthenticatedUserContext(authHeader);

    if (!authContext.ok) {
        if (authContext.reason === "unauthenticated") {
            return {
                ok: false,
                statusCode: 401,
                error: SESSION_ERROR.UNAUTHORIZED,
                message: "A valid authenticated user is required to join a session.",
            };
        }

        return {
            ok: false,
            statusCode: 502,
            error: SESSION_ERROR.USER_SERVICE_UNAVAILABLE,
            message: authContext.message,
        };
    }

    const accessResult = await validateSessionAccess(sessionId, authContext.userId);

    if (!accessResult.ok) {
        return accessResult;
    }

    return {
        ok: true,
        session: accessResult.session,
    };
}
