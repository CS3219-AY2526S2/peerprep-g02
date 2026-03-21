import { ERROR_CODES, HTTP_STATUS } from "@/config/constants.js";
import type { CollaborationSession, CreateSessionRequest } from "@/models/session.js";
import { SessionCacheRepository } from "@/repositories/sessionCacheRepository.js";
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

export class CollaborationSessionService {
    constructor(
        private readonly sessionRepository: SessionRepository,
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
}

const sessionRepository = new SessionRepository();
const sessionCacheRepository = new SessionCacheRepository();
const userValidationService = new UserValidationService();
const questionSelectionService = new QuestionSelectionService();

export const collaborationSessionService = new CollaborationSessionService(
    sessionRepository,
    sessionCacheRepository,
    userValidationService,
    questionSelectionService,
);
