import type {
    CollaborationSession,
    SessionErrorCode,
} from "@/models/model.js";
import { SESSION_ERROR, SESSION_STATUS } from "@/models/model.js";
import { sessionRepository } from "@/repositories/sessionRepository.js";

type SessionAccessSuccess = {
    ok: true;
    session: CollaborationSession;
};

type SessionAccessFailure =
    | { ok: false; statusCode: 403; error: SessionErrorCode; message: string }
    | { ok: false; statusCode: 404; error: SessionErrorCode; message: string }
    | { ok: false; statusCode: 409; error: SessionErrorCode; message: string };

export type SessionAccessResult = SessionAccessSuccess | SessionAccessFailure;

export async function validateSessionAccess(
    sessionId: string,
    userId: string,
): Promise<SessionAccessResult> {
    const session = await sessionRepository.findBySessionId(sessionId);

    if (!session) {
        return {
            ok: false,
            statusCode: 404,
            error: SESSION_ERROR.SESSION_NOT_FOUND,
            message: "No collaboration session was found for the provided sessionId.",
        };
    }

    if (session.status !== SESSION_STATUS.ACTIVE) {
        return {
            ok: false,
            statusCode: 409,
            error: SESSION_ERROR.SESSION_NOT_ACTIVE,
            message: "Only active collaboration sessions may be joined.",
        };
    }

    const isAssignedUser = userId === session.userAId || userId === session.userBId;

    if (!isAssignedUser) {
        return {
            ok: false,
            statusCode: 403,
            error: SESSION_ERROR.FORBIDDEN_SESSION_ACCESS,
            message: "Authenticated user is not assigned to this session.",
        };
    }

    return {
        ok: true,
        session,
    };
}
