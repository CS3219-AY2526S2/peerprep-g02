import {
    CollaborationSession,
    JoinSessionErrorCode,
    JoinSessionResponse,
    SessionStatus,
} from "@/models/models.js";
import { SessionJoinError } from "@/services/errors.js";
import { DependencyUnavailableError } from "@/services/httpClient.js";
import { sessionPresenceManager } from "@/services/sessionPresenceManager.js";
import { sessionService } from "@/services/sessionService.js";
import { UserGatewayClient } from "@/services/userGatewayClient.js";

type JoinSessionDependencies = {
    sessionService: {
        getSessionById: (sessionId: string) => Promise<CollaborationSession | null>;
    };
    userGatewayClient: UserGatewayClient;
    presenceManager: typeof sessionPresenceManager;
};

export class SessionJoinService {
    constructor(private readonly deps: JoinSessionDependencies) {}

    async joinSession(
        sessionId: string,
        authorizationHeader: string,
    ): Promise<JoinSessionResponse> {
        if (!authorizationHeader.trim()) {
            throw new SessionJoinError(
                401,
                JoinSessionErrorCode.UNAUTHENTICATED_USER,
                "Authentication is required to join the session.",
            );
        }

        const authContext = await this.deps.userGatewayClient
            .validateAuthorizationContext(authorizationHeader)
            .catch((error: unknown) => {
                if (error instanceof DependencyUnavailableError) {
                    throw new SessionJoinError(
                        424,
                        JoinSessionErrorCode.SERVICE_DEPENDENCY_ERROR,
                        "User Service is unavailable. Session join aborted.",
                    );
                }

                throw error;
            });

        if (!authContext?.clerkUserId || authContext.status !== "active") {
            throw new SessionJoinError(
                403,
                JoinSessionErrorCode.UNAUTHENTICATED_USER,
                "Authenticated active user context is required to join the session.",
            );
        }

        const session = await this.deps.sessionService.getSessionById(sessionId);
        if (!session) {
            throw new SessionJoinError(
                404,
                JoinSessionErrorCode.SESSION_NOT_FOUND,
                "Session does not exist.",
            );
        }

        if (session.status !== SessionStatus.ACTIVE) {
            throw new SessionJoinError(
                409,
                JoinSessionErrorCode.SESSION_NOT_ACTIVE,
                "Session is not active.",
            );
        }

        const isAssignedUser =
            session.userAId === authContext.clerkUserId ||
            session.userBId === authContext.clerkUserId;

        if (!isAssignedUser) {
            throw new SessionJoinError(
                403,
                JoinSessionErrorCode.USER_NOT_ASSIGNED_TO_SESSION,
                "User is not assigned to this session.",
            );
        }

        return {
            session,
            currentUserId: authContext.clerkUserId,
            participants: this.deps.presenceManager.getPresence(session),
        };
    }
}

export const sessionJoinService = new SessionJoinService({
    sessionService,
    userGatewayClient: new UserGatewayClient(),
    presenceManager: sessionPresenceManager,
});
