import { ERROR_CODES, HTTP_STATUS } from "@/config/constants.js";
import type {
    CollaborationSession,
    CreateSessionRequest,
    SessionJoinState,
} from "@/models/session.js";
import { SessionCacheRepository } from "@/repositories/sessionCacheRepository.js";
import { SessionPresenceRepository } from "@/repositories/sessionPresenceRepository.js";
import { SessionRepository } from "@/repositories/sessionRepository.js";
import { AppError } from "@/utils/errors.js";
import { logger } from "@/utils/logger.js";

import { QuestionSelectionService } from "./questionSelectionService.js";
import { UserValidationService } from "./userValidationService.js";

export type CreateSessionResponse = {
    session: CollaborationSession;
    idempotentHit: boolean;
    cacheWriteSucceeded: boolean;
};

export type JoinSessionInput = {
    collaborationId: string;
    userId: string;
    socketId: string;
};

export class CollaborationSessionService {
    constructor(
        private readonly sessionRepository: SessionRepository,
        private readonly sessionPresenceRepository: SessionPresenceRepository,
        private readonly sessionCacheRepository: SessionCacheRepository,
        private readonly userValidationService: UserValidationService,
        private readonly questionSelectionService: QuestionSelectionService,
    ) {}

    async createSession(payload: CreateSessionRequest): Promise<CreateSessionResponse> {
        await this.userValidationService.validateUsers([payload.userAId, payload.userBId]);
        const selectedQuestion = await this.questionSelectionService.selectQuestion(payload);

        const result = this.sessionRepository.createActiveSession({
            ...payload,
            questionId: selectedQuestion.questionId,
        });

        if (result.conflict) {
            throw new AppError(
                ERROR_CODES.ACTIVE_SESSION_CONFLICT,
                HTTP_STATUS.CONFLICT,
                "An active collaboration already exists for this matched user pair.",
                {
                    collaborationId: result.session.collaborationId,
                },
            );
        }

        const cacheWriteSucceeded = await this.sessionCacheRepository.cacheActiveSession(
            result.session,
        );

        if (!cacheWriteSucceeded) {
            logger.warn(
                { collaborationId: result.session.collaborationId },
                "Session created without cache support",
            );
        }

        return {
            session: result.session,
            idempotentHit: result.idempotentHit,
            cacheWriteSucceeded,
        };
    }

    joinSession(input: JoinSessionInput): SessionJoinState {
        const session = this.sessionRepository.getSessionByCollaborationId(input.collaborationId);

        if (!session) {
            throw new AppError(
                ERROR_CODES.SESSION_NOT_FOUND,
                HTTP_STATUS.NOT_FOUND,
                "Collaboration session was not found.",
            );
        }

        if (session.status !== "active") {
            throw new AppError(
                ERROR_CODES.SESSION_INACTIVE,
                HTTP_STATUS.CONFLICT,
                "Collaboration session is not active.",
            );
        }

        const assignedUserIds = [session.userAId, session.userBId];
        if (!assignedUserIds.includes(input.userId)) {
            throw new AppError(
                ERROR_CODES.SESSION_ACCESS_DENIED,
                HTTP_STATUS.FORBIDDEN,
                "Authenticated user is not assigned to this collaboration session.",
            );
        }

        const distinctUsers = this.sessionPresenceRepository.getDistinctUserIds(
            input.collaborationId,
        );
        if (distinctUsers.size >= 2 && !distinctUsers.has(input.userId)) {
            throw new AppError(
                ERROR_CODES.SESSION_CAPACITY_REACHED,
                HTTP_STATUS.CONFLICT,
                "Collaboration session already has two distinct users present.",
            );
        }

        this.sessionPresenceRepository.addSocketConnection(
            input.collaborationId,
            input.userId,
            input.socketId,
        );

        return {
            session,
            questionId: session.questionId,
            codeSnapshot: this.sessionRepository.getCodeSnapshot(input.collaborationId),
            participants: this.sessionPresenceRepository.getParticipants(
                input.collaborationId,
                assignedUserIds,
            ),
        };
    }

    handleDisconnect(socketId: string): { collaborationId: string; participants: SessionJoinState["participants"] } | null {
        const binding = this.sessionPresenceRepository.removeSocketConnection(socketId);
        if (!binding) {
            return null;
        }

        const session = this.sessionRepository.getSessionByCollaborationId(binding.collaborationId);
        if (!session) {
            return null;
        }

        return {
            collaborationId: binding.collaborationId,
            participants: this.sessionPresenceRepository.getParticipants(binding.collaborationId, [
                session.userAId,
                session.userBId,
            ]),
        };
    }
}

const sessionRepository = new SessionRepository();
const sessionPresenceRepository = new SessionPresenceRepository();
const sessionCacheRepository = new SessionCacheRepository();
const userValidationService = new UserValidationService();
const questionSelectionService = new QuestionSelectionService();

export const collaborationSessionService = new CollaborationSessionService(
    sessionRepository,
    sessionPresenceRepository,
    sessionCacheRepository,
    userValidationService,
    questionSelectionService,
);
