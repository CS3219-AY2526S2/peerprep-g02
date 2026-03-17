import { describe, expect, it, jest } from "@jest/globals";

import {
    AuthenticatedUser,
    CollaborationSession,
    CreateSessionErrorCode,
    QuestionSummary,
    SessionDifficulty,
    SessionStatus,
} from "@/models/models.js";
import { SessionCreationError } from "@/services/errors.js";
import { DependencyUnavailableError } from "@/services/httpClient.js";
import { SessionRepository } from "@/services/sessionRepository.js";
import { SessionService } from "@/services/sessionService.js";

const createUserAuthBatchMock = () =>
    jest.fn<(userIds: string[]) => Promise<AuthenticatedUser[]>>();

const createQuestionMock = () =>
    jest.fn<
        (topic: string, difficulty: SessionDifficulty) => Promise<QuestionSummary>
    >();

const createCacheMock = () =>
    jest.fn<(session: CollaborationSession) => Promise<void>>();

const createPublishMock = () =>
    jest.fn<(session: CollaborationSession) => void>();

describe("SessionService", () => {
    it("creates a session after validating users and selecting a question", async () => {
        const sessionRepository = new SessionRepository();
        const validateAuthenticatedUsers = createUserAuthBatchMock().mockResolvedValue([
            { userId: "user-a", isAuthenticated: true },
            { userId: "user-b", isAuthenticated: true },
        ]);
        const getQuestion = createQuestionMock().mockResolvedValue({
            questionId: "question-123",
        });
        const cacheSession = createCacheMock().mockResolvedValue(undefined);
        const publishSessionCreated = createPublishMock();
        const service = new SessionService({
            sessionRepository,
            userGatewayClient: {
                validateAuthenticatedUsers,
            },
            questionGatewayClient: {
                getQuestion,
            },
            cacheSession,
            publishSessionCreated,
        });

        const result = await service.createSession({
            userAId: "user-a",
            userBId: "user-b",
            difficulty: SessionDifficulty.MEDIUM,
            language: "TypeScript",
            topic: "Dynamic Programming",
        });

        expect(result.idempotentHit).toBe(false);
        expect(result.session.questionId).toBe("question-123");
        expect(result.session.status).toBe(SessionStatus.ACTIVE);
        expect(cacheSession).toHaveBeenCalledWith(result.session);
        expect(publishSessionCreated).toHaveBeenCalledWith(result.session);
    });

    it("returns the existing active session for duplicate requests", async () => {
        const sessionRepository = new SessionRepository();
        const existingSession = sessionRepository.save({
            sessionId: "session-1",
            userAId: "user-a",
            userBId: "user-b",
            difficulty: SessionDifficulty.EASY,
            language: "Python",
            topic: "Arrays",
            questionId: "question-1",
            status: SessionStatus.ACTIVE,
            createdAt: new Date().toISOString(),
        });

        const service = new SessionService({
            sessionRepository,
            userGatewayClient: {
                validateAuthenticatedUsers: createUserAuthBatchMock(),
            },
            questionGatewayClient: {
                getQuestion: createQuestionMock(),
            },
            cacheSession: createCacheMock().mockResolvedValue(undefined),
            publishSessionCreated: createPublishMock(),
        });

        const result = await service.createSession({
            userAId: "user-b",
            userBId: "user-a",
            difficulty: SessionDifficulty.HARD,
            language: "Java",
            topic: "Graphs",
        });

        expect(result.idempotentHit).toBe(true);
        expect(result.session).toEqual(existingSession);
    });

    it("rejects the request if either user is not authenticated", async () => {
        const validateAuthenticatedUsers = createUserAuthBatchMock().mockResolvedValue([
            { userId: "user-a", isAuthenticated: true },
            { userId: "user-b", isAuthenticated: false },
        ]);

        const service = new SessionService({
            sessionRepository: new SessionRepository(),
            userGatewayClient: {
                validateAuthenticatedUsers,
            },
            questionGatewayClient: {
                getQuestion: createQuestionMock(),
            },
            cacheSession: createCacheMock().mockResolvedValue(undefined),
            publishSessionCreated: createPublishMock(),
        });

        await expect(
            service.createSession({
                userAId: "user-a",
                userBId: "user-b",
                difficulty: SessionDifficulty.MEDIUM,
                language: "TypeScript",
                topic: "Trees",
            }),
        ).rejects.toMatchObject({
            statusCode: 403,
            code: CreateSessionErrorCode.AUTHENTICATION_VALIDATION_FAILED,
        });
    });

    it("returns a dependency error when the user service is unavailable", async () => {
        const validateAuthenticatedUsers = createUserAuthBatchMock().mockRejectedValue(
            new DependencyUnavailableError("boom"),
        );

        const service = new SessionService({
            sessionRepository: new SessionRepository(),
            userGatewayClient: {
                validateAuthenticatedUsers,
            },
            questionGatewayClient: {
                getQuestion: createQuestionMock(),
            },
            cacheSession: createCacheMock().mockResolvedValue(undefined),
            publishSessionCreated: createPublishMock(),
        });

        await expect(
            service.createSession({
                userAId: "user-a",
                userBId: "user-b",
                difficulty: SessionDifficulty.MEDIUM,
                language: "TypeScript",
                topic: "Trees",
            }),
        ).rejects.toMatchObject({
            statusCode: 424,
            code: CreateSessionErrorCode.SERVICE_DEPENDENCY_ERROR,
        });
    });

    it("continues creating the session when cache storage fails", async () => {
        const validateAuthenticatedUsers = createUserAuthBatchMock().mockResolvedValue([
            { userId: "user-a", isAuthenticated: true },
            { userId: "user-b", isAuthenticated: true },
        ]);
        const getQuestion = createQuestionMock().mockResolvedValue({
            questionId: "question-123",
        });
        const cacheSession = createCacheMock().mockImplementation(async () => {
            throw new Error("cache unavailable");
        });

        const service = new SessionService({
            sessionRepository: new SessionRepository(),
            userGatewayClient: {
                validateAuthenticatedUsers,
            },
            questionGatewayClient: {
                getQuestion,
            },
            cacheSession,
            publishSessionCreated: createPublishMock(),
        });

        const result = await service.createSession({
            userAId: "user-a",
            userBId: "user-b",
            difficulty: SessionDifficulty.MEDIUM,
            language: "TypeScript",
            topic: "Backtracking",
        });

        expect(result.session.questionId).toBe("question-123");
        expect(result.idempotentHit).toBe(false);
    });
});
