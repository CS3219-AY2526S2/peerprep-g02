import { randomUUID } from "node:crypto";

import {
    CollaborationSession,
    CreateSessionErrorCode,
    CreateSessionRequest,
    CreateSessionResponse,
    SessionStatus,
} from "@/models/models.js";
import { SessionCreationError } from "@/services/errors.js";
import { DependencyUnavailableError } from "@/services/httpClient.js";
import { QuestionGatewayClient } from "@/services/questionGatewayClient.js";
import { sessionCache } from "@/services/singletons.js";
import { SessionRepository } from "@/services/sessionRepository.js";
import { sessionEventBus } from "@/services/sessionEvents.js";
import { UserGatewayClient } from "@/services/userGatewayClient.js";
import { logger } from "@/utils/logger.js";

type SessionServiceDependencies = {
    sessionRepository: SessionRepository;
    userGatewayClient: UserGatewayClient;
    questionGatewayClient: QuestionGatewayClient;
    cacheSession: (session: CollaborationSession) => Promise<void>;
    publishSessionCreated: (session: CollaborationSession) => void;
};

export class SessionService {
    constructor(private readonly deps: SessionServiceDependencies) {}

    async createSession(
        payload: CreateSessionRequest,
    ): Promise<CreateSessionResponse> {
        const existingSession = this.deps.sessionRepository.findActiveByUsers(
            payload.userAId,
            payload.userBId,
        );

        if (existingSession) {
            return {
                session: existingSession,
                idempotentHit: true,
            };
        }

        const [userA, userB] = await this.deps.userGatewayClient
            .validateAuthenticatedUsers([payload.userAId, payload.userBId])
            .catch((error: unknown) => {
            if (error instanceof DependencyUnavailableError) {
                throw new SessionCreationError(
                    424,
                    CreateSessionErrorCode.SERVICE_DEPENDENCY_ERROR,
                    "User Service is unavailable. Session creation aborted.",
                );
            }

            throw error;
        });

        if (!userA.isAuthenticated || !userB.isAuthenticated) {
            throw new SessionCreationError(
                403,
                CreateSessionErrorCode.AUTHENTICATION_VALIDATION_FAILED,
                "Both matched users must be authenticated before a session can be created.",
            );
        }

        const question = await this.deps.questionGatewayClient
            .getQuestion(payload.topic, payload.difficulty)
            .catch((error: unknown) => {
                if (error instanceof DependencyUnavailableError) {
                    throw new SessionCreationError(
                        424,
                        CreateSessionErrorCode.SERVICE_DEPENDENCY_ERROR,
                        "Question Service is unavailable. Session creation aborted.",
                    );
                }

                throw error;
            });

        const session: CollaborationSession = {
            sessionId: randomUUID(),
            userAId: payload.userAId,
            userBId: payload.userBId,
            difficulty: payload.difficulty,
            language: payload.language,
            topic: payload.topic,
            questionId: question.questionId,
            status: SessionStatus.ACTIVE,
            createdAt: new Date().toISOString(),
        };

        this.deps.sessionRepository.save(session);

        try {
            await this.deps.cacheSession(session);
        } catch (error) {
            logger.warn(
                { err: error, sessionId: session.sessionId },
                "Failed to cache session. Continuing without cache.",
            );
        }

        this.deps.publishSessionCreated(session);

        return {
            session,
            idempotentHit: false,
        };
    }

    async getSessionById(sessionId: string): Promise<CollaborationSession | null> {
        const existingSession = this.deps.sessionRepository.findById(sessionId);
        if (existingSession) {
            return existingSession;
        }

        const cachedSession = await sessionCache.get(sessionId);
        if (!cachedSession) {
            return null;
        }

        this.deps.sessionRepository.save(cachedSession);
        return cachedSession;
    }
}

export const sessionService = new SessionService({
    sessionRepository: new SessionRepository(),
    userGatewayClient: new UserGatewayClient(),
    questionGatewayClient: new QuestionGatewayClient(),
    cacheSession: async (session) => sessionCache.set(session),
    publishSessionCreated: (session) => sessionEventBus.publishSessionCreated(session),
});
