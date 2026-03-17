import { describe, expect, it, jest } from "@jest/globals";

import {
    JoinSessionErrorCode,
    SessionDifficulty,
    SessionParticipantStatus,
    SessionStatus,
    type CollaborationSession,
} from "@/models/models.js";
import { SessionJoinError } from "@/services/errors.js";
import { DependencyUnavailableError } from "@/services/httpClient.js";
import { SessionJoinService } from "@/services/sessionJoinService.js";
import { SessionPresenceManager } from "@/services/sessionPresenceManager.js";

const activeSession: CollaborationSession = {
    sessionId: "session-1",
    userAId: "user-a",
    userBId: "user-b",
    difficulty: SessionDifficulty.MEDIUM,
    language: "TypeScript",
    topic: "Trees",
    questionId: "question-1",
    status: SessionStatus.ACTIVE,
    createdAt: new Date().toISOString(),
};

describe("SessionJoinService", () => {
    it("allows an assigned authenticated user to join an active session", async () => {
        const service = new SessionJoinService({
            sessionService: {
                getSessionById: jest.fn().mockResolvedValue(activeSession),
            },
            userGatewayClient: {
                validateAuthorizationContext: jest.fn().mockResolvedValue({
                    clerkUserId: "user-a",
                    status: "active",
                }),
            } as never,
            presenceManager: new SessionPresenceManager(),
        });

        const result = await service.joinSession("session-1", "Bearer token");

        expect(result.currentUserId).toBe("user-a");
        expect(result.session).toEqual(activeSession);
        expect(result.participants).toEqual([
            {
                userId: "user-a",
                status: SessionParticipantStatus.DISCONNECTED,
            },
            {
                userId: "user-b",
                status: SessionParticipantStatus.DISCONNECTED,
            },
        ]);
    });

    it("rejects unauthenticated users", async () => {
        const service = new SessionJoinService({
            sessionService: {
                getSessionById: jest.fn(),
            },
            userGatewayClient: {
                validateAuthorizationContext: jest.fn().mockResolvedValue(null),
            } as never,
            presenceManager: new SessionPresenceManager(),
        });

        await expect(service.joinSession("session-1", "Bearer token")).rejects.toMatchObject({
            statusCode: 403,
            code: JoinSessionErrorCode.UNAUTHENTICATED_USER,
        } satisfies Partial<SessionJoinError>);
    });

    it("rejects users who are not assigned to the session", async () => {
        const service = new SessionJoinService({
            sessionService: {
                getSessionById: jest.fn().mockResolvedValue(activeSession),
            },
            userGatewayClient: {
                validateAuthorizationContext: jest.fn().mockResolvedValue({
                    clerkUserId: "user-c",
                    status: "active",
                }),
            } as never,
            presenceManager: new SessionPresenceManager(),
        });

        await expect(service.joinSession("session-1", "Bearer token")).rejects.toMatchObject({
            statusCode: 403,
            code: JoinSessionErrorCode.USER_NOT_ASSIGNED_TO_SESSION,
        } satisfies Partial<SessionJoinError>);
    });

    it("rejects missing sessions", async () => {
        const service = new SessionJoinService({
            sessionService: {
                getSessionById: jest.fn().mockResolvedValue(null),
            },
            userGatewayClient: {
                validateAuthorizationContext: jest.fn().mockResolvedValue({
                    clerkUserId: "user-a",
                    status: "active",
                }),
            } as never,
            presenceManager: new SessionPresenceManager(),
        });

        await expect(service.joinSession("session-1", "Bearer token")).rejects.toMatchObject({
            statusCode: 404,
            code: JoinSessionErrorCode.SESSION_NOT_FOUND,
        } satisfies Partial<SessionJoinError>);
    });

    it("rejects inactive sessions", async () => {
        const service = new SessionJoinService({
            sessionService: {
                getSessionById: jest.fn().mockResolvedValue({
                    ...activeSession,
                    status: SessionStatus.ENDED,
                }),
            },
            userGatewayClient: {
                validateAuthorizationContext: jest.fn().mockResolvedValue({
                    clerkUserId: "user-a",
                    status: "active",
                }),
            } as never,
            presenceManager: new SessionPresenceManager(),
        });

        await expect(service.joinSession("session-1", "Bearer token")).rejects.toMatchObject({
            statusCode: 409,
            code: JoinSessionErrorCode.SESSION_NOT_ACTIVE,
        } satisfies Partial<SessionJoinError>);
    });

    it("returns a dependency error when user service auth context is unavailable", async () => {
        const service = new SessionJoinService({
            sessionService: {
                getSessionById: jest.fn(),
            },
            userGatewayClient: {
                validateAuthorizationContext: jest
                    .fn()
                    .mockRejectedValue(new DependencyUnavailableError("boom")),
            } as never,
            presenceManager: new SessionPresenceManager(),
        });

        await expect(service.joinSession("session-1", "Bearer token")).rejects.toMatchObject({
            statusCode: 424,
            code: JoinSessionErrorCode.SERVICE_DEPENDENCY_ERROR,
        } satisfies Partial<SessionJoinError>);
    });
});
