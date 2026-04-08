import type { UUID } from "node:crypto";

import { DEFAULTS, ERROR_CODES, HTTP_STATUS } from "@/config/constants.js";
import { env } from "@/config/env.js";
import type {
    CollaborationSession,
    CreateSessionRequest,
    OTOperation,
    RoomState,
    SessionJoinState,
} from "@/models/session.js";
import { RedisHintRepository, type StoredHint } from "@/repositories/redisHintRepository.js";
import { RedisOTRepository } from "@/repositories/redisOTRepository.js";
import { RedisOutputRepository } from "@/repositories/redisOutputRepository.js";
import { RedisPresenceRepository } from "@/repositories/redisPresenceRepository.js";
import { RedisSessionRepository } from "@/repositories/redisSessionRepository.js";
import { SessionCacheRepository } from "@/repositories/sessionCacheRepository.js";
import { AiHintService } from "@/services/aiHintService.js";
import { OTDocumentManager } from "@/services/otService.js";
import { QuestionSelectionService } from "@/services/questionSelectionService.js";
import { UserValidationService } from "@/services/userValidationService.js";
import { AppError } from "@/utils/errors.js";
import { logger } from "@/utils/logger.js";

export type CreateSessionResponse = {
    session: CollaborationSession;
    idempotentHit: boolean;
    cacheWriteSucceeded: boolean;
};

export type JoinSessionInput = {
    collaborationId: UUID;
    userId: UUID;
    socketId: string;
};

export type JoinSessionResult = SessionJoinState & {
    isFirstConnection: boolean;
    wasDisconnected: boolean;
    disconnectDurationMs: number;
};

export type ApplyCodeChangeInput = {
    collaborationId: UUID;
    userId: UUID;
    revision: number;
    operations: OTOperation[];
};

export type ApplyCodeChangeResult =
    | {
          ok: true;
          transformedOps: OTOperation[];
          newRevision: number;
          newContent: string;
      }
    | {
          ok: false;
          error: string;
          message: string;
          needsSync?: boolean;
      };

export type LeaveSessionResult = {
    collaborationId: UUID;
    userId: UUID;
    participants: SessionJoinState["participants"];
    sessionEnded: boolean;
    removedSocketIds: string[];
    isLastSocket: boolean;
} | null;

export type EndSessionResult = {
    collaborationId: UUID;
    reason: "both_users_left" | "inactivity_timeout" | "manual";
    finalCode: string;
    finalCodeRevision: number;
};

function generateCodeTemplate(language: string, functionName: string): string {
    const lang = language.toLowerCase();
    switch (lang) {
        case "python":
            return `class Solution:\n    def ${functionName}(self):\n        pass\n`;
        case "javascript":
            return `class Solution {\n    ${functionName}() {\n        \n    }\n}\n`;
        case "typescript":
            return `class Solution {\n    ${functionName}() {\n        \n    }\n}\n`;
        case "java":
            return `class Solution {\n    public void ${functionName}() {\n        \n    }\n}\n`;
        default:
            return "";
    }
}

export class CollaborationSessionService {
    private readonly otManager: OTDocumentManager;

    constructor(
        private readonly redisSessionRepository: RedisSessionRepository,
        private readonly redisPresenceRepository: RedisPresenceRepository,
        redisOTRepository: RedisOTRepository,
        private readonly redisOutputRepository: RedisOutputRepository,
        private readonly sessionCacheRepository: SessionCacheRepository,
        private readonly userValidationService: UserValidationService,
        private readonly questionSelectionService: QuestionSelectionService,
        private readonly redisHintRepository: RedisHintRepository,
        private readonly aiHintService: AiHintService,
    ) {
        this.otManager = new OTDocumentManager(redisOTRepository);
    }

    async getActiveSessionForUser(
        userId: string,
    ): Promise<{ collaborationId: string; topic: string; difficulty: string } | null> {
        const session = await this.redisSessionRepository.getActiveSessionForUser(userId);
        if (!session) {
            return null;
        }

        // Check if user has intentionally left
        const hasLeft = await this.redisPresenceRepository.hasUserLeft(
            session.collaborationId,
            userId,
        );
        if (hasLeft) {
            return null;
        }

        // Check if rejoin grace period has expired for disconnected users
        const rejoinCheck = await this.redisPresenceRepository.canRejoinWithinGracePeriod(
            session.collaborationId,
            userId,
            env.disconnectGraceMs,
        );
        if (!rejoinCheck.canRejoin) {
            // Grace period expired — clean up stale active-session index
            await this.redisSessionRepository.clearUserActiveSession(userId);
            return null;
        }

        return {
            collaborationId: session.collaborationId,
            topic: session.topic,
            difficulty: session.difficulty,
        };
    }

    async getUserNames(userIds: string[]): Promise<Record<string, string>> {
        try {
            const users = await this.userValidationService.validateUsers(userIds);
            const names: Record<string, string> = {};
            for (const user of users) {
                names[user.userId] = user.name ?? user.userId;
            }
            return names;
        } catch {
            // Non-fatal: fall back to user IDs
            const names: Record<string, string> = {};
            for (const id of userIds) {
                names[id] = id;
            }
            return names;
        }
    }

    async createSession(payload: CreateSessionRequest): Promise<CreateSessionResponse> {
        await this.userValidationService.validateUsers([payload.userAId, payload.userBId]);
        const selectedQuestion = await this.questionSelectionService.selectQuestion(payload);

        const result = await this.redisSessionRepository.createActiveSession({
            ...payload,
            questionId: selectedQuestion.questionId as UUID,
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

        // If this is a new session, initialize OT document with a code template
        if (result.created) {
            let initialCode = "";
            try {
                const questionDetails = await this.questionSelectionService.getQuestionDetails(
                    result.session.questionId,
                );
                if (questionDetails?.functionName) {
                    initialCode = generateCodeTemplate(
                        result.session.language,
                        questionDetails.functionName,
                    );
                }
            } catch (error) {
                logger.warn(
                    { err: error, collaborationId: result.session.collaborationId },
                    "Failed to fetch question details for code template",
                );
            }
            await this.otManager.initializeDocument(result.session.collaborationId, initialCode);
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

    async joinSession(input: JoinSessionInput): Promise<JoinSessionResult> {
        const session = await this.redisSessionRepository.getSessionByCollaborationId(
            input.collaborationId,
        );

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

        // Check if user has already left the session
        const hasUserLeft = await this.redisPresenceRepository.hasUserLeft(
            input.collaborationId,
            input.userId,
        );
        if (hasUserLeft) {
            throw new AppError(
                ERROR_CODES.SESSION_ACCESS_DENIED,
                HTTP_STATUS.FORBIDDEN,
                "You have already left this collaboration session.",
            );
        }

        // F4.7.1 - Check rejoin grace period for disconnected users
        const rejoinCheck = await this.redisPresenceRepository.canRejoinWithinGracePeriod(
            input.collaborationId,
            input.userId,
            env.disconnectGraceMs,
        );

        if (!rejoinCheck.canRejoin && rejoinCheck.disconnectDurationMs > 0) {
            const gracePeriodSec = Math.round(rejoinCheck.gracePeriodMs / 1000);
            const disconnectSec = Math.round(rejoinCheck.disconnectDurationMs / 1000);
            throw new AppError(
                ERROR_CODES.REJOIN_GRACE_PERIOD_EXPIRED,
                HTTP_STATUS.FORBIDDEN,
                `Rejoin period expired. You were disconnected for ${disconnectSec}s (limit: ${gracePeriodSec}s).`,
            );
        }

        const distinctUsers = await this.redisPresenceRepository.getDistinctUserIds(
            input.collaborationId,
        );
        if (distinctUsers.size >= 2 && !distinctUsers.has(input.userId)) {
            throw new AppError(
                ERROR_CODES.SESSION_CAPACITY_REACHED,
                HTTP_STATUS.CONFLICT,
                "Collaboration session already has two distinct users present.",
            );
        }

        // F4.6.5 - Track reconnection, server state is authoritative
        const { isFirstConnection, wasDisconnected, disconnectDurationMs } =
            await this.redisPresenceRepository.addSocketConnection(
                input.collaborationId,
                input.userId,
                input.socketId,
            );

        if (wasDisconnected) {
            logger.info(
                {
                    collaborationId: input.collaborationId,
                    userId: input.userId,
                    disconnectDurationMs,
                },
                "User reconnected after disconnection",
            );
        }

        // Get current document state
        const codeSnapshot = await this.otManager.getContent(input.collaborationId);
        const codeRevision = await this.otManager.getRevision(input.collaborationId);

        // Fetch question details from question service
        const question = await this.questionSelectionService.getQuestionDetails(session.questionId);

        // Cache question details in Redis for execution/submission
        if (question && isFirstConnection) {
            try {
                await this.redisSessionRepository.storeQuestionDetails(input.collaborationId, {
                    questionTitle: question.title,
                    questionDescription: question.description,
                    testCases: JSON.stringify(question.testCase),
                    functionName: question.functionName,
                });
            } catch (error) {
                logger.warn(
                    { err: error, collaborationId: input.collaborationId },
                    "Failed to cache question details in Redis",
                );
            }
        }

        // F4.6.5 - Return authoritative server state for reconciliation
        return {
            session,
            questionId: session.questionId,
            question: question ?? undefined,
            codeSnapshot,
            codeRevision,
            participants: await this.redisPresenceRepository.getParticipants(
                input.collaborationId,
                assignedUserIds,
            ),
            isFirstConnection,
            wasDisconnected,
            disconnectDurationMs,
        };
    }

    /**
     * F4.5.1 - Allow users in session to modify code while session is active
     * F4.5.2 - Accept changes only from users who are part of the session
     * F4.5.3 - Apply changes in order (via OT revision tracking)
     * F4.5.5 - Ensure both users see same version (OT transformation)
     * F4.5.6 - Resolve concurrent changes using OT conflict resolution
     */
    async applyCodeChange(input: ApplyCodeChangeInput): Promise<ApplyCodeChangeResult> {
        // F4.5.2 - Validate user is part of the session
        const session = await this.redisSessionRepository.getSessionByCollaborationId(
            input.collaborationId,
        );
        if (!session) {
            logger.warn(
                { collaborationId: input.collaborationId },
                "Session not found for code change",
            );
            return {
                ok: false,
                error: ERROR_CODES.SESSION_NOT_FOUND,
                message: "Collaboration session was not found.",
            };
        }

        // F4.5.2 - Only accept changes from assigned users
        const assignedUserIds = [session.userAId, session.userBId];
        if (!assignedUserIds.includes(input.userId)) {
            logger.warn(
                { collaborationId: input.collaborationId, userId: input.userId },
                "Unauthorized user attempted code change",
            );
            return {
                ok: false,
                error: ERROR_CODES.SESSION_ACCESS_DENIED,
                message: "You are not authorized to modify code in this session.",
            };
        }

        // F4.5.1 - Only allow changes while session is active
        if (session.status !== "active") {
            logger.warn(
                { collaborationId: input.collaborationId, status: session.status },
                "Code change attempted on inactive session",
            );
            return {
                ok: false,
                error: ERROR_CODES.SESSION_INACTIVE,
                message: "Cannot modify code - session is no longer active.",
            };
        }

        // F4.5.1 - Check user hasn't left the session
        const hasUserLeft = await this.redisPresenceRepository.hasUserLeft(
            input.collaborationId,
            input.userId,
        );
        if (hasUserLeft) {
            return {
                ok: false,
                error: ERROR_CODES.SESSION_ACCESS_DENIED,
                message: "You have left this session and cannot modify code.",
            };
        }

        // F4.5.3 & F4.5.6 - Apply changes in order with OT conflict resolution
        const result = await this.otManager.applyClientOperations(
            input.collaborationId,
            input.userId,
            input.revision,
            input.operations,
        );

        if (!result) {
            const currentRevision = await this.otManager.getRevision(input.collaborationId);
            logger.warn(
                {
                    collaborationId: input.collaborationId,
                    userId: input.userId,
                    clientRevision: input.revision,
                    serverRevision: currentRevision,
                },
                "Failed to apply OT operations - client out of sync",
            );
            return {
                ok: false,
                error: "SYNC_REQUIRED",
                message: "Your editor is out of sync. Synchronizing...",
                needsSync: true,
            };
        }

        logger.debug(
            {
                collaborationId: input.collaborationId,
                userId: input.userId,
                oldRevision: input.revision,
                newRevision: result.newRevision,
                operationCount: input.operations.length,
            },
            "Code change applied successfully",
        );

        // F4.5.5 - Return transformed operations for broadcast to ensure consistency
        return {
            ok: true,
            transformedOps: result.transformedOps,
            newRevision: result.newRevision,
            newContent: result.newContent,
        };
    }

    async leaveSession(socketId: string, userId: string): Promise<LeaveSessionResult> {
        const binding = await this.redisPresenceRepository.getSocketBinding(socketId);
        if (!binding || binding.userId !== userId) {
            return null;
        }

        const session = await this.redisSessionRepository.getSessionByCollaborationId(
            binding.collaborationId,
        );
        if (!session) {
            return null;
        }

        // Remove only the leaving socket (not all tabs)
        await this.redisPresenceRepository.removeSocketConnection(socketId);

        // Check if the user has any remaining sockets open
        const remainingSockets = await this.redisPresenceRepository.getUserSocketIds(
            binding.collaborationId,
            userId,
        );

        const removedSocketIds = [socketId];
        const isLastSocket = remainingSockets.length === 0;

        if (isLastSocket) {
            // Only mark user as "left" when their last tab closes
            await this.redisPresenceRepository.markUserAsLeft(binding.collaborationId, userId);
            await this.redisSessionRepository.clearUserActiveSession(userId);
        }

        const assignedUserIds = [session.userAId, session.userBId];
        const participants = await this.redisPresenceRepository.getParticipants(
            binding.collaborationId,
            assignedUserIds,
        );

        // F4.8.2 - Check if both users have left (only possible when last socket closed)
        let sessionEnded = false;
        if (isLastSocket) {
            sessionEnded = await this.redisPresenceRepository.haveBothUsersLeft(
                binding.collaborationId,
                assignedUserIds,
            );

            // Also end if this user left and the other is disconnected (not coming back)
            if (!sessionEnded) {
                const otherUserId = assignedUserIds.find((id) => id !== userId);
                if (otherUserId) {
                    const otherStatus = await this.redisPresenceRepository.getUserPresenceStatus(
                        binding.collaborationId,
                        otherUserId,
                    );
                    if (otherStatus === "disconnected") {
                        sessionEnded = true;
                    }
                }
            }
        }

        if (sessionEnded) {
            await this.endSession(binding.collaborationId, "both_users_left");
        }

        return {
            collaborationId: binding.collaborationId,
            userId,
            participants,
            sessionEnded,
            removedSocketIds,
            isLastSocket,
        };
    }

    /**
     * F4.8.2, F4.8.3, F4.9 - End a collaboration session
     */
    async getHints(collaborationId: string): Promise<StoredHint[]> {
        return this.redisHintRepository.getHints(collaborationId);
    }

    async getHintsRemaining(collaborationId: string, userId: string): Promise<number> {
        return this.redisHintRepository.getHintsRemaining(collaborationId, userId);
    }

    async requestHint(
        collaborationId: string,
        userId: string,
    ): Promise<{ hints: StoredHint[]; hintsRemaining: number }> {
        // Check rate limit
        const remaining = await this.redisHintRepository.getHintsRemaining(collaborationId, userId);
        if (remaining <= 0) {
            throw new AppError(
                `You have used all ${DEFAULTS.MAX_HINTS_PER_USER} AI hints for this session.`,
                HTTP_STATUS.BAD_REQUEST,
                ERROR_CODES.HINT_LIMIT_REACHED,
            );
        }

        // Get session context for the prompt
        const session =
            await this.redisSessionRepository.getSessionByCollaborationId(collaborationId);
        if (!session || session.status !== "active") {
            throw new AppError("Session not found or inactive.", HTTP_STATUS.NOT_FOUND, ERROR_CODES.SESSION_NOT_FOUND);
        }

        // Verify the user is part of this session
        if (session.userAId !== userId && session.userBId !== userId) {
            throw new AppError("Access denied.", HTTP_STATUS.FORBIDDEN, ERROR_CODES.SESSION_ACCESS_DENIED);
        }

        const code = await this.otManager.getContent(collaborationId);
        const questionDetails =
            await this.redisSessionRepository.getQuestionDetails(collaborationId);

        const previousHints = await this.redisHintRepository.getHints(collaborationId);

        // Generate hint via Gemini
        const hintText = await this.aiHintService.generateHint({
            questionTitle: questionDetails?.questionTitle ?? session.topic,
            questionDescription: questionDetails?.questionDescription ?? "",
            difficulty: session.difficulty,
            language: session.language,
            currentCode: code,
            previousHints: previousHints.map((h) => h.hint),
        });

        // Store the hint
        const allHints = await this.redisHintRepository.addHint(collaborationId, userId, hintText);
        const hintsRemaining = remaining - 1;

        logger.info(
            { collaborationId, userId, hintsRemaining },
            "AI hint generated and stored",
        );

        return { hints: allHints, hintsRemaining };
    }

    async endSession(
        collaborationId: string,
        reason: EndSessionResult["reason"],
    ): Promise<EndSessionResult | null> {
        const session =
            await this.redisSessionRepository.getSessionByCollaborationId(collaborationId);
        if (!session || session.status !== "active") {
            return null;
        }

        // Get final code state before cleanup
        const finalCode = await this.otManager.getContent(collaborationId);
        const finalCodeRevision = await this.otManager.getRevision(collaborationId);

        const assignedUserIds = [session.userAId, session.userBId];

        // F4.9.3 - Mark session as inactive in Redis
        await this.redisSessionRepository.markSessionInactive(collaborationId);

        // Clear user → active session index for both users
        for (const uid of assignedUserIds) {
            await this.redisSessionRepository.clearUserActiveSession(uid);
        }

        // F4.9.4 - Cleanup Redis data
        await this.redisSessionRepository.deleteSessionData(collaborationId);
        await this.redisPresenceRepository.cleanupSession(collaborationId, assignedUserIds);
        await this.otManager.deleteDocument(collaborationId);
        await this.redisOutputRepository.deleteOutput(collaborationId);
        await this.redisHintRepository.deleteHints(collaborationId, assignedUserIds);

        logger.info(
            {
                collaborationId,
                reason,
                finalCodeRevision,
            },
            "Collaboration session ended",
        );

        return {
            collaborationId: collaborationId as UUID,
            reason,
            finalCode,
            finalCodeRevision,
        };
    }

    /**
     * F4.8.3 - Check for inactive sessions
     */
    async getInactiveSessions(inactivityTimeoutMs: number): Promise<string[]> {
        const activeSessions = await this.redisSessionRepository.getActiveSessions();
        const inactiveSessionIds: string[] = [];

        for (const session of activeSessions) {
            const isInactive = await this.redisPresenceRepository.isSessionInactive(
                session.collaborationId,
                inactivityTimeoutMs,
            );
            if (isInactive) {
                inactiveSessionIds.push(session.collaborationId);
            }
        }

        return inactiveSessionIds;
    }

    /**
     * Update session activity (called on code changes)
     */
    async updateSessionActivity(collaborationId: string): Promise<void> {
        await this.redisPresenceRepository.updateSessionActivity(collaborationId);
    }

    async getRoomState(collaborationId: string): Promise<RoomState | null> {
        const session =
            await this.redisSessionRepository.getSessionByCollaborationId(collaborationId);
        if (!session) {
            return null;
        }

        const participants = await this.redisPresenceRepository.getParticipants(collaborationId, [
            session.userAId,
            session.userBId,
        ]);

        const code = await this.otManager.getContent(collaborationId);
        const codeRevision = await this.otManager.getRevision(collaborationId);
        const output = await this.redisOutputRepository.getOutput(collaborationId);

        return {
            collaborationId: collaborationId as UUID,
            questionId: session.questionId,
            code,
            codeRevision,
            language: session.language,
            output,
            participants,
        };
    }

    async updateOutput(collaborationId: string, output: string): Promise<void> {
        await this.redisOutputRepository.setOutput(collaborationId, output);
    }

    async getSessionForExecution(collaborationId: string): Promise<{
        session: CollaborationSession;
        code: string;
        questionTitle: string;
        testCases: Array<{ input: unknown; output: unknown }>;
        functionName: string;
    } | null> {
        const session =
            await this.redisSessionRepository.getSessionByCollaborationId(collaborationId);
        if (!session || session.status !== "active") {
            return null;
        }

        const code = await this.otManager.getContent(collaborationId);
        const questionDetails =
            await this.redisSessionRepository.getQuestionDetails(collaborationId);

        if (!questionDetails) {
            return null;
        }

        let testCases: Array<{ input: unknown; output: unknown }>;
        try {
            testCases = JSON.parse(questionDetails.testCases);
        } catch {
            testCases = [];
        }

        return {
            session,
            code,
            questionTitle: questionDetails.questionTitle,
            testCases,
            functionName: questionDetails.functionName,
        };
    }

    async handleDisconnect(socketId: string): Promise<{
        collaborationId: string;
        userId: string;
        participants: SessionJoinState["participants"];
        isLastConnection: boolean;
    } | null> {
        const result = await this.redisPresenceRepository.removeSocketConnection(socketId);
        if (!result) {
            return null;
        }

        const session = await this.redisSessionRepository.getSessionByCollaborationId(
            result.binding.collaborationId,
        );
        if (!session) {
            return null;
        }

        return {
            collaborationId: result.binding.collaborationId,
            userId: result.binding.userId,
            participants: await this.redisPresenceRepository.getParticipants(
                result.binding.collaborationId,
                [session.userAId, session.userBId],
            ),
            isLastConnection: result.isLastConnection,
        };
    }
}

// Initialize repositories
const redisSessionRepository = new RedisSessionRepository();
const redisPresenceRepository = new RedisPresenceRepository();
const redisOTRepository = new RedisOTRepository();
const redisOutputRepository = new RedisOutputRepository();
const sessionCacheRepository = new SessionCacheRepository();
const userValidationService = new UserValidationService();
const questionSelectionService = new QuestionSelectionService();
const redisHintRepository = new RedisHintRepository();
const aiHintService = new AiHintService();

export const collaborationSessionService = new CollaborationSessionService(
    redisSessionRepository,
    redisPresenceRepository,
    redisOTRepository,
    redisOutputRepository,
    sessionCacheRepository,
    userValidationService,
    questionSelectionService,
    redisHintRepository,
    aiHintService,
);
