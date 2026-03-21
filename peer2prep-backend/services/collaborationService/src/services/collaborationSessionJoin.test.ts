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
    it("allows multiple sockets for the same assigned user", () => {
        const session = buildSession();
        const presenceRepository = {
            getDistinctUserIds: vi
                .fn()
                .mockReturnValueOnce(new Set<string>())
                .mockReturnValueOnce(new Set<string>(["user-1"])),
            addSocketConnection: vi.fn(),
            getParticipants: vi
                .fn()
                .mockReturnValue([
                    { userId: "user-1", status: "online", connectionCount: 2 },
                    { userId: "user-2", status: "offline", connectionCount: 0 },
                ]),
            removeSocketConnection: vi.fn(),
        };

        const service = new CollaborationSessionService(
            {
                getSessionByCollaborationId: vi.fn().mockReturnValue(session),
                getCodeSnapshot: vi.fn().mockReturnValue(""),
                createActiveSession: vi.fn(),
            } as never,
            presenceRepository as never,
            {} as never,
            {} as never,
            {} as never,
        );

        const firstJoin = service.joinSession({
            collaborationId: "collab-1",
            userId: "user-1",
            socketId: "socket-1",
        });
        const secondJoin = service.joinSession({
            collaborationId: "collab-1",
            userId: "user-1",
            socketId: "socket-2",
        });

        expect(firstJoin.session.collaborationId).toBe("collab-1");
        expect(secondJoin.participants[0].connectionCount).toBe(2);
    });

    it("rejects an unassigned user from joining a session", () => {
        const session = buildSession();
        const service = new CollaborationSessionService(
            {
                getSessionByCollaborationId: vi.fn().mockReturnValue(session),
                getCodeSnapshot: vi.fn().mockReturnValue(""),
                createActiveSession: vi.fn(),
            } as never,
            {
                getDistinctUserIds: vi.fn().mockReturnValue(new Set<string>(["user-1", "user-2"])),
                addSocketConnection: vi.fn(),
                getParticipants: vi.fn(),
                removeSocketConnection: vi.fn(),
            } as never,
            {} as never,
            {} as never,
            {} as never,
        );

        try {
            service.joinSession({
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
