import { describe, expect, it, vi } from "vitest";

import type { CollaborationSession, CreateSessionRequest } from "../models/session.js";
import { CollaborationSessionService } from "./collaborationSessionService.js";

const payload: CreateSessionRequest = {
    matchId: "match-1",
    userAId: "user-a",
    userBId: "user-b",
    difficulty: "Medium",
    language: "typescript",
    topic: "arrays",
};

function buildSession(): CollaborationSession {
    return {
        collaborationId: "collab-1",
        matchId: payload.matchId,
        userAId: payload.userAId,
        userBId: payload.userBId,
        difficulty: payload.difficulty,
        language: payload.language,
        topic: payload.topic,
        questionId: "question-1",
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
                insertSession: vi.fn(),
                updateSessionEnded: vi.fn(),
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
        );

        const result = await service.createSession(payload);

        expect(result.idempotentHit).toBe(true);
        expect(result.session.collaborationId).toBe("collab-1");
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
                insertSession: vi.fn(),
                updateSessionEnded: vi.fn(),
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
        );

        const result = await service.createSession(payload);

        expect(result.session.questionId).toBe("question-1");
        expect(result.cacheWriteSucceeded).toBe(false);
    });
});
