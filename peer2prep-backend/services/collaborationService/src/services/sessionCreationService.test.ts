import { jest } from "@jest/globals";

import type { CollaborationSession } from "@/models/model.js";

const mockFindActiveByPair = jest.fn<(...args: unknown[]) => Promise<CollaborationSession | null>>();
const mockCreateActiveSession = jest.fn<(...args: unknown[]) => Promise<CollaborationSession>>();
const mockCacheSession = jest.fn<(...args: unknown[]) => Promise<boolean>>();
const mockFetchQuestionForSession = jest.fn<
    (...args: unknown[]) => Promise<{ ok: true; questionId: string } | { ok: false; errorType: string; message: string }>
>();
const mockVerifyUsersAuthentication = jest.fn<
    (...args: unknown[]) => Promise<
        | { valid: true }
        | { valid: false; errorType: "AUTHENTICATION_FAILED"; failedUserIds: string[] }
        | { valid: false; errorType: "SERVICE_DEPENDENCY_ERROR"; message: string }
    >
>();

jest.unstable_mockModule("@/repositories/sessionRepository.js", () => ({
    buildPairKey: (userAId: string, userBId: string) => [userAId, userBId].sort().join(":"),
    sessionRepository: {
        findActiveByPair: mockFindActiveByPair,
        createActiveSession: mockCreateActiveSession,
    },
}));

jest.unstable_mockModule("@/services/sessionCache.js", () => ({
    sessionCache: {
        cacheSession: mockCacheSession,
    },
}));

jest.unstable_mockModule("@/services/questionService.js", () => ({
    fetchQuestionForSession: mockFetchQuestionForSession,
}));

jest.unstable_mockModule("@/services/userAuthService.js", () => ({
    verifyUsersAuthentication: mockVerifyUsersAuthentication,
}));

const { createSession } = await import("./sessionCreationService.js");

const existingSession: CollaborationSession = {
    sessionId: "session-existing",
    pairKey: "user-a:user-b",
    userAId: "user-a",
    userBId: "user-b",
    difficulty: "Medium",
    language: "TypeScript",
    topic: "Graphs",
    questionId: "question-existing",
    status: "active",
    createdAt: "2026-03-16T00:00:00.000Z",
};

describe("createSession", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns an authentication failure when a matched user is inactive", async () => {
        mockVerifyUsersAuthentication.mockResolvedValue({
            valid: false,
            errorType: "AUTHENTICATION_FAILED",
            failedUserIds: ["user-b"],
        });

        const result = await createSession({
            userAId: "user-a",
            userBId: "user-b",
            difficulty: "Medium",
            language: "TypeScript",
            topic: "Graphs",
        });

        expect(result).toEqual({
            ok: false,
            statusCode: 403,
            error: "MATCH_USERS_NOT_ACTIVE",
            message: "One or more matched users are not active.",
            failedUserIds: ["user-b"],
        });
        expect(mockFetchQuestionForSession).not.toHaveBeenCalled();
        expect(mockCreateActiveSession).not.toHaveBeenCalled();
    });

    it("returns a dependency error when user service lookup fails", async () => {
        mockVerifyUsersAuthentication.mockResolvedValue({
            valid: false,
            errorType: "SERVICE_DEPENDENCY_ERROR",
            message: "User service timed out.",
        });

        const result = await createSession({
            userAId: "user-a",
            userBId: "user-b",
            difficulty: "Easy",
            language: "Python",
            topic: "Arrays",
        });

        expect(result).toEqual({
            ok: false,
            statusCode: 502,
            error: "USER_SERVICE_UNAVAILABLE",
            message: "User service timed out.",
        });
    });

    it("returns an existing active session for duplicate user pairs", async () => {
        mockVerifyUsersAuthentication.mockResolvedValue({ valid: true });
        mockFindActiveByPair.mockResolvedValue(existingSession);
        mockCacheSession.mockResolvedValue(true);

        const result = await createSession({
            userAId: "user-b",
            userBId: "user-a",
            difficulty: "Medium",
            language: "TypeScript",
            topic: "Graphs",
        });

        expect(result).toEqual({
            ok: true,
            session: existingSession,
            created: false,
            cacheStored: true,
        });
        expect(mockFetchQuestionForSession).not.toHaveBeenCalled();
        expect(mockCacheSession).toHaveBeenCalledWith(existingSession);
    });

    it("creates and caches a new session after validation succeeds", async () => {
        const createdSession: CollaborationSession = {
            sessionId: "session-new",
            pairKey: "user-a:user-b",
            userAId: "user-a",
            userBId: "user-b",
            difficulty: "Hard",
            language: "Java",
            topic: "DP",
            questionId: "question-123",
            status: "active",
            createdAt: "2026-03-16T10:00:00.000Z",
        };

        mockVerifyUsersAuthentication.mockResolvedValue({ valid: true });
        mockFindActiveByPair.mockResolvedValue(null);
        mockFetchQuestionForSession.mockResolvedValue({
            ok: true,
            questionId: "question-123",
        });
        mockCreateActiveSession.mockResolvedValue(createdSession);
        mockCacheSession.mockResolvedValue(false);

        const result = await createSession({
            userAId: "user-a",
            userBId: "user-b",
            difficulty: "Hard",
            language: "Java",
            topic: "DP",
        });

        expect(mockCreateActiveSession).toHaveBeenCalledWith(
            {
                userAId: "user-a",
                userBId: "user-b",
                difficulty: "Hard",
                language: "Java",
                topic: "DP",
            },
            "question-123",
        );
        expect(mockCacheSession).toHaveBeenCalledWith(createdSession);
        expect(result).toEqual({
            ok: true,
            session: createdSession,
            created: true,
            cacheStored: false,
        });
    });
});
