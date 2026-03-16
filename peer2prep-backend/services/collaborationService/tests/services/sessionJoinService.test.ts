import { jest } from "@jest/globals";

import type { CollaborationSession } from "@/models/model.js";

const mockFindBySessionId = jest.fn<(...args: unknown[]) => Promise<CollaborationSession | null>>();
const mockFetchAuthenticatedUserContext = jest.fn<
    (...args: unknown[]) => Promise<
        | { ok: true; userId: string; role?: string }
        | { ok: false; reason: "unauthenticated" }
        | { ok: false; userId: string; reason: "dependency_error"; message: string }
    >
>();
jest.unstable_mockModule("@/services/sessionAccessService.js", () => ({
    validateSessionAccess: jest.fn(async (sessionId: string, userId: string) => {
        const session = await mockFindBySessionId(sessionId, userId);
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

        if (userId !== session.userAId && userId !== session.userBId) {
            return {
                ok: false,
                statusCode: 403,
                error: "FORBIDDEN_SESSION_ACCESS",
                message: "Authenticated user is not assigned to this session.",
            };
        }

        return {
            ok: true,
            session,
        };
    }),
}));

jest.unstable_mockModule("@/services/userAuthService.js", () => ({
    fetchAuthenticatedUserContext: mockFetchAuthenticatedUserContext,
}));

const { joinSession } = await import("@/services/sessionJoinService.js");

const activeSession: CollaborationSession = {
    sessionId: "session-123",
    pairKey: "user-a:user-b",
    userAId: "user-a",
    userBId: "user-b",
    difficulty: "Medium",
    language: "TypeScript",
    topic: "Graphs",
    questionId: "question-1",
    status: "active",
    createdAt: "2026-03-16T00:00:00.000Z",
};

describe("joinSession", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("rejects unauthenticated users", async () => {
        mockFetchAuthenticatedUserContext.mockResolvedValue({
            ok: false,
            reason: "unauthenticated",
        });

        await expect(joinSession("session-123", undefined)).resolves.toEqual({
            ok: false,
            statusCode: 401,
            error: "UNAUTHORIZED",
            message: "A valid authenticated user is required to join a session.",
        });
    });

    it("rejects joins when the user service is unavailable", async () => {
        mockFetchAuthenticatedUserContext.mockResolvedValue({
            ok: false,
            userId: "unknown",
            reason: "dependency_error",
            message: "User service returned 503.",
        });

        await expect(joinSession("session-123", "Bearer token")).resolves.toEqual({
            ok: false,
            statusCode: 502,
            error: "USER_SERVICE_UNAVAILABLE",
            message: "User service returned 503.",
        });
    });

    it("rejects joins for unknown sessions", async () => {
        mockFetchAuthenticatedUserContext.mockResolvedValue({
            ok: true,
            userId: "user-a",
        });
        mockFindBySessionId.mockResolvedValue(null);

        await expect(joinSession("missing-session", "Bearer token")).resolves.toEqual({
            ok: false,
            statusCode: 404,
            error: "SESSION_NOT_FOUND",
            message: "No collaboration session was found for the provided sessionId.",
        });
    });

    it("rejects joins for inactive sessions", async () => {
        mockFetchAuthenticatedUserContext.mockResolvedValue({
            ok: true,
            userId: "user-a",
        });
        mockFindBySessionId.mockResolvedValue({
            ...activeSession,
            status: "inactive",
        });

        await expect(joinSession("session-123", "Bearer token")).resolves.toEqual({
            ok: false,
            statusCode: 409,
            error: "SESSION_NOT_ACTIVE",
            message: "Only active collaboration sessions may be joined.",
        });
    });

    it("rejects users who are not assigned to the session", async () => {
        mockFetchAuthenticatedUserContext.mockResolvedValue({
            ok: true,
            userId: "user-c",
        });
        mockFindBySessionId.mockResolvedValue(activeSession);

        await expect(joinSession("session-123", "Bearer token")).resolves.toEqual({
            ok: false,
            statusCode: 403,
            error: "FORBIDDEN_SESSION_ACCESS",
            message: "Authenticated user is not assigned to this session.",
        });
    });

    it("allows assigned users to join active sessions", async () => {
        mockFetchAuthenticatedUserContext.mockResolvedValue({
            ok: true,
            userId: "user-b",
        });
        mockFindBySessionId.mockResolvedValue(activeSession);

        await expect(joinSession("session-123", "Bearer token")).resolves.toEqual({
            ok: true,
            session: activeSession,
        });
    });
});
