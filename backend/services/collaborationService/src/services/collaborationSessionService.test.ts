import type { UUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import type { CollaborationSession, CreateSessionRequest } from "../models/session.js";
import { CollaborationSessionService } from "./collaborationSessionService.js";

const payload: CreateSessionRequest = {
    matchId: "00000000-0000-0000-0000-000000000001" as UUID,
    userAId: "00000000-0000-0000-0000-000000000011" as UUID,
    userBId: "00000000-0000-0000-0000-000000000012" as UUID,
    difficulty: "Medium",
    language: "typescript",
    topic: "arrays",
};

function buildSession(): CollaborationSession {
    return {
        collaborationId: "00000000-0000-0000-0000-000000000002" as UUID,
        matchId: payload.matchId,
        userAId: payload.userAId,
        userBId: payload.userBId,
        difficulty: payload.difficulty,
        language: payload.language,
        topic: payload.topic,
        questionId: "00000000-0000-0000-0000-000000000021" as UUID,
        status: "active",
        createdAt: new Date().toISOString(),
    };
}

describe("CollaborationSessionService", () => {
    it("returns an idempotent hit when the repository already has the same active session", async () => {
        const session = buildSession();
        const service = new CollaborationSessionService(
            {
                createActiveSession: vi.fn().mockResolvedValue({
                    session,
                    created: false,
                    idempotentHit: true,
                    conflict: false,
                }),
                getSessionByCollaborationId: vi.fn(),
                getActiveSessions: vi.fn(),
                markSessionInactive: vi.fn(),
                deleteSessionData: vi.fn(),
            } as never,
            {
                getDistinctUserIds: vi.fn(),
                addSocketConnection: vi.fn(),
                getParticipants: vi.fn(),
                removeSocketConnection: vi.fn(),
                cleanupSession: vi.fn(),
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
                cacheActiveSession: vi.fn().mockResolvedValue(true),
            } as never,
            {
                validateUsers: vi.fn().mockResolvedValue([
                    { userId: payload.userAId, status: "active" },
                    { userId: payload.userBId, status: "active" },
                ]),
            } as never,
            {
                selectQuestion: vi.fn().mockResolvedValue({
                    questionId: session.questionId,
                    topic: payload.topic,
                    difficulty: payload.difficulty,
                }),
            } as never,
            {} as never,
            {} as never,
        );

        const result = await service.createSession(payload);

        expect(result.idempotentHit).toBe(true);
        expect(result.session.collaborationId).toBe("00000000-0000-0000-0000-000000000002");
    });

    it("does not fail session creation when cache write fails", async () => {
        const session = buildSession();
        const service = new CollaborationSessionService(
            {
                createActiveSession: vi.fn().mockResolvedValue({
                    session,
                    created: true,
                    idempotentHit: false,
                    conflict: false,
                }),
                getSessionByCollaborationId: vi.fn(),
                getActiveSessions: vi.fn(),
                markSessionInactive: vi.fn(),
                deleteSessionData: vi.fn(),
            } as never,
            {
                getDistinctUserIds: vi.fn(),
                addSocketConnection: vi.fn(),
                getParticipants: vi.fn(),
                removeSocketConnection: vi.fn(),
                cleanupSession: vi.fn(),
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
                cacheActiveSession: vi.fn().mockResolvedValue(false),
            } as never,
            {
                validateUsers: vi.fn().mockResolvedValue([
                    { userId: payload.userAId, status: "active" },
                    { userId: payload.userBId, status: "active" },
                ]),
            } as never,
            {
                selectQuestion: vi.fn().mockResolvedValue({
                    questionId: session.questionId,
                    topic: payload.topic,
                    difficulty: payload.difficulty,
                }),
            } as never,
            {} as never,
            {} as never,
        );

        const result = await service.createSession(payload);

        expect(result.session.questionId).toBe("00000000-0000-0000-0000-000000000021");
        expect(result.cacheWriteSucceeded).toBe(false);
    });
});
