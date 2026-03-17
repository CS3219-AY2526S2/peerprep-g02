import { describe, expect, it } from "@jest/globals";

import {
    SessionDifficulty,
    SessionParticipantStatus,
    SessionStatus,
    type CollaborationSession,
} from "@/models/models.js";
import { SessionPresenceManager } from "@/services/sessionPresenceManager.js";

const session: CollaborationSession = {
    sessionId: "session-1",
    userAId: "user-a",
    userBId: "user-b",
    difficulty: SessionDifficulty.EASY,
    language: "Python",
    topic: "Arrays",
    questionId: "question-1",
    status: SessionStatus.ACTIVE,
    createdAt: new Date().toISOString(),
};

describe("SessionPresenceManager", () => {
    it("tracks connected and disconnected users", () => {
        const manager = new SessionPresenceManager();

        const connected = manager.markConnected(session, "user-a", "socket-1");
        expect(connected.firstConnection).toBe(true);
        expect(connected.participants[0].status).toBe(SessionParticipantStatus.CONNECTED);

        const disconnected = manager.markDisconnected(session, "user-a", "socket-1");
        expect(disconnected.becameDisconnected).toBe(true);
        expect(disconnected.participants[0].status).toBe(
            SessionParticipantStatus.DISCONNECTED,
        );
    });

    it("tracks intentional leave state", () => {
        const manager = new SessionPresenceManager();

        manager.markConnected(session, "user-a", "socket-1");
        const left = manager.markLeft(session, "user-a", "socket-1");

        expect(left.becameLeft).toBe(true);
        expect(left.participants[0].status).toBe(SessionParticipantStatus.LEFT);
    });

    it("does not emit disconnect when another socket is still connected", () => {
        const manager = new SessionPresenceManager();

        manager.markConnected(session, "user-a", "socket-1");
        manager.markConnected(session, "user-a", "socket-2");

        const disconnected = manager.markDisconnected(session, "user-a", "socket-1");

        expect(disconnected.becameDisconnected).toBe(false);
        expect(disconnected.participants[0].status).toBe(
            SessionParticipantStatus.CONNECTED,
        );
    });
});
