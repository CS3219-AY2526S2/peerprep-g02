import { describe, expect, it, vi } from "vitest";

import { AppError } from "../utils/errors.js";
import type { CollaborationSession } from "../models/session.js";
import { CollaborationSessionService } from "./collaborationSessionService.js";

function buildSession(): CollaborationSession {
    return {
        collaborationId: "collab-1",
        userAId: "user-1",
        userBId: "user-2",
        difficulty: "Medium",
        language: "typescript",
        topic: "arrays",
        questionId: "question-1",
        status: "active",
        createdAt: new Date().toISOString(),
    };
}

describe("CollaborationSessionService join flow", () => {
    it("allows multiple sockets for the same assigned user", async () => {
        const session = buildSession();
        const presenceRepository = {
            getDistinctUserIds: vi
                .fn()
                .mockResolvedValueOnce(new Set<string>())
                .mockResolvedValueOnce(new Set<string>(["user-1"])),
            addSocketConnection: vi.fn().mockResolvedValue({
                isFirstConnection: true,
                wasDisconnected: false,
                disconnectDurationMs: 0,
            }),
            getParticipants: vi
                .fn()
                .mockResolvedValue([
                    { userId: "user-1", status: "online", connectionCount: 2 },
                    { userId: "user-2", status: "offline", connectionCount: 0 },
                ]),
            removeSocketConnection: vi.fn(),
            hasUserLeft: vi.fn().mockResolvedValue(false),
            canRejoinWithinGracePeriod: vi.fn().mockResolvedValue({
                canRejoin: true,
                disconnectDurationMs: 0,
                gracePeriodMs: 30000,
            }),
        };

        const otRepository = {
            initializeDocument: vi.fn(),
            getDocument: vi.fn().mockResolvedValue({ content: "", revision: 0 }),
            getContent: vi.fn().mockResolvedValue(""),
            getRevision: vi.fn().mockResolvedValue(0),
            updateDocument: vi.fn(),
            deleteDocument: vi.fn(),
        };

        const service = new CollaborationSessionService(
            {
                getSessionByCollaborationId: vi.fn().mockResolvedValue(session),
                createActiveSession: vi.fn(),
                getActiveSessions: vi.fn(),
                markSessionInactive: vi.fn(),
                deleteSessionData: vi.fn(),
            } as never,
            presenceRepository as never,
            otRepository as never,
            {
                setOutput: vi.fn(),
                getOutput: vi.fn(),
                deleteOutput: vi.fn(),
            } as never,
            {
                insertSession: vi.fn(),
                updateSessionEnded: vi.fn(),
            } as never,
            {} as never,
            {} as never,
            {} as never,
        );

        const firstJoin = await service.joinSession({
            collaborationId: "collab-1",
            userId: "user-1",
            socketId: "socket-1",
        });
        const secondJoin = await service.joinSession({
            collaborationId: "collab-1",
            userId: "user-1",
            socketId: "socket-2",
        });

        expect(firstJoin.session.collaborationId).toBe("collab-1");
        expect(secondJoin.participants[0].connectionCount).toBe(2);
    });

    it("rejects an unassigned user from joining a session", async () => {
        const session = buildSession();
        const service = new CollaborationSessionService(
            {
                getSessionByCollaborationId: vi.fn().mockResolvedValue(session),
                createActiveSession: vi.fn(),
                getActiveSessions: vi.fn(),
                markSessionInactive: vi.fn(),
                deleteSessionData: vi.fn(),
            } as never,
            {
                getDistinctUserIds: vi.fn().mockResolvedValue(new Set<string>(["user-1", "user-2"])),
                addSocketConnection: vi.fn(),
                getParticipants: vi.fn(),
                removeSocketConnection: vi.fn(),
                hasUserLeft: vi.fn().mockResolvedValue(false),
                canRejoinWithinGracePeriod: vi.fn().mockResolvedValue({
                    canRejoin: true,
                    disconnectDurationMs: 0,
                    gracePeriodMs: 30000,
                }),
            } as never,
            {
                initializeDocument: vi.fn(),
                getDocument: vi.fn(),
                getContent: vi.fn(),
                getRevision: vi.fn(),
                updateDocument: vi.fn(),
                deleteDocument: vi.fn(),
            } as never,
            {
                setOutput: vi.fn(),
                getOutput: vi.fn(),
                deleteOutput: vi.fn(),
            } as never,
            {
                insertSession: vi.fn(),
                updateSessionEnded: vi.fn(),
            } as never,
            {} as never,
            {} as never,
            {} as never,
        );

        try {
            await service.joinSession({
                collaborationId: "collab-1",
                userId: "user-3",
                socketId: "socket-3",
            });
        } catch (error) {
            expect(error).toBeInstanceOf(AppError);
            expect((error as AppError).code).toBe("SESSION_ACCESS_DENIED");
            return;
        }

        throw new Error("Expected joinSession to reject an unassigned user.");
    });
});
