import {
    CollaborationSession,
    SessionParticipantPresence,
    SessionParticipantStatus,
} from "@/models/models.js";

type PresenceEntry = {
    status: SessionParticipantStatus;
    connectionIds: Set<string>;
};

type SessionPresenceState = Map<string, PresenceEntry>;

function createDefaultEntry(): PresenceEntry {
    return {
        status: SessionParticipantStatus.DISCONNECTED,
        connectionIds: new Set<string>(),
    };
}

export class SessionPresenceManager {
    private readonly presenceBySession = new Map<string, SessionPresenceState>();

    private ensureSessionState(session: CollaborationSession): SessionPresenceState {
        const existing = this.presenceBySession.get(session.sessionId);
        if (existing) {
            return existing;
        }

        const state: SessionPresenceState = new Map([
            [session.userAId, createDefaultEntry()],
            [session.userBId, createDefaultEntry()],
        ]);

        this.presenceBySession.set(session.sessionId, state);
        return state;
    }

    getPresence(session: CollaborationSession): SessionParticipantPresence[] {
        const state = this.ensureSessionState(session);
        return [session.userAId, session.userBId].map((userId) => ({
            userId,
            status: state.get(userId)?.status ?? SessionParticipantStatus.DISCONNECTED,
        }));
    }

    markConnected(
        session: CollaborationSession,
        userId: string,
        connectionId: string,
    ): { firstConnection: boolean; participants: SessionParticipantPresence[] } {
        const state = this.ensureSessionState(session);
        const entry = state.get(userId);

        if (!entry) {
            throw new Error("User is not assigned to the session.");
        }

        const firstConnection = entry.connectionIds.size === 0;
        entry.connectionIds.add(connectionId);
        entry.status = SessionParticipantStatus.CONNECTED;

        return {
            firstConnection,
            participants: this.getPresence(session),
        };
    }

    markDisconnected(
        session: CollaborationSession,
        userId: string,
        connectionId: string,
    ): { becameDisconnected: boolean; participants: SessionParticipantPresence[] } {
        const state = this.ensureSessionState(session);
        const entry = state.get(userId);

        if (!entry) {
            throw new Error("User is not assigned to the session.");
        }

        entry.connectionIds.delete(connectionId);
        const becameDisconnected =
            entry.connectionIds.size === 0 &&
            entry.status !== SessionParticipantStatus.LEFT;

        if (becameDisconnected) {
            entry.status = SessionParticipantStatus.DISCONNECTED;
        }

        return {
            becameDisconnected,
            participants: this.getPresence(session),
        };
    }

    markLeft(
        session: CollaborationSession,
        userId: string,
        connectionId: string,
    ): { becameLeft: boolean; participants: SessionParticipantPresence[] } {
        const state = this.ensureSessionState(session);
        const entry = state.get(userId);

        if (!entry) {
            throw new Error("User is not assigned to the session.");
        }

        entry.connectionIds.delete(connectionId);
        const becameLeft = entry.status !== SessionParticipantStatus.LEFT;
        entry.connectionIds.clear();
        entry.status = SessionParticipantStatus.LEFT;

        return {
            becameLeft,
            participants: this.getPresence(session),
        };
    }
}

export const sessionPresenceManager = new SessionPresenceManager();
