import { sessionRepository } from "@/repositories/sessionRepository.js";
import { fetchAuthenticatedUserContext } from "@/services/userAuthService.js";
import { sessionPresenceService } from "@/services/sessionPresenceService.js";

type SessionJoinSuccess = {
    ok: true;
    session: Awaited<ReturnType<typeof sessionRepository.findBySessionId>> extends infer T
        ? Exclude<T, null>
        : never;
    participantCount: number;
};

type SessionJoinFailure =
    | { ok: false; statusCode: 401; error: "UNAUTHORIZED"; message: string }
    | { ok: false; statusCode: 403; error: "FORBIDDEN_SESSION_ACCESS"; message: string }
    | { ok: false; statusCode: 404; error: "SESSION_NOT_FOUND"; message: string }
    | { ok: false; statusCode: 409; error: "SESSION_NOT_ACTIVE" | "SESSION_CAPACITY_REACHED"; message: string }
    | { ok: false; statusCode: 502; error: "USER_SERVICE_UNAVAILABLE"; message: string };

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
                error: "UNAUTHORIZED",
                message: "A valid authenticated user is required to join a session.",
            };
        }

        return {
            ok: false,
            statusCode: 502,
            error: "USER_SERVICE_UNAVAILABLE",
            message: authContext.message,
        };
    }

    const session = await sessionRepository.findBySessionId(sessionId);

    if (!session) {
        return {
            ok: false,
            statusCode: 404,
            error: "SESSION_NOT_FOUND",
            message: "No collaboration session was found for the provided sessionId.",
        };
    }

    if (session.status !== "active") {
        return {
            ok: false,
            statusCode: 409,
            error: "SESSION_NOT_ACTIVE",
            message: "Only active collaboration sessions may be joined.",
        };
    }

    const isAssignedUser = authContext.userId === session.userAId || authContext.userId === session.userBId;

    if (!isAssignedUser) {
        return {
            ok: false,
            statusCode: 403,
            error: "FORBIDDEN_SESSION_ACCESS",
            message: "Authenticated user is not assigned to this session.",
        };
    }

    const presenceResult = await sessionPresenceService.join(session.sessionId, authContext.userId);

    if (!presenceResult.allowed) {
        return {
            ok: false,
            statusCode: 409,
            error: "SESSION_CAPACITY_REACHED",
            message: "No more than two users may be present in a collaboration session.",
        };
    }

    return {
        ok: true,
        session,
        participantCount: presenceResult.participantCount,
    };
}
