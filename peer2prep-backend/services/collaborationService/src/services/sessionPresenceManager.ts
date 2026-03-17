/** Tracks per-session participant presence states across realtime socket connections. */
import {
    CollaborationSession,
    SessionParticipantPresence,
    SessionParticipantStatus,
} from "@/models/models.js";

type PresenceEntry = {
    status: SessionParticipantStatus;
    connectionIds: Set<string>;
    disconnectTimeout?: NodeJS.Timeout;
    disconnectedAt?: number;
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

    constructor(private readonly disconnectGraceMs: number = 30000) {}

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
        if (entry.disconnectTimeout) {
            clearTimeout(entry.disconnectTimeout);
            entry.disconnectTimeout = undefined;
        }
        entry.disconnectedAt = undefined;
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
    ): {
        becameDisconnected: boolean;
        participants: SessionParticipantPresence[];
        dropAt: number | null;
    } {
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
            entry.disconnectedAt = Date.now();
            entry.disconnectTimeout = setTimeout(() => {
                if (entry.status === SessionParticipantStatus.DISCONNECTED) {
                    entry.disconnectTimeout = undefined;
                }
            }, this.disconnectGraceMs);
            entry.disconnectTimeout.unref?.();
        }

        return {
            becameDisconnected,
            participants: this.getPresence(session),
            dropAt:
                becameDisconnected && entry.disconnectedAt
                    ? entry.disconnectedAt + this.disconnectGraceMs
                    : null,
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
        if (entry.disconnectTimeout) {
            clearTimeout(entry.disconnectTimeout);
            entry.disconnectTimeout = undefined;
        }
        entry.connectionIds.clear();
        entry.disconnectedAt = undefined;
        entry.status = SessionParticipantStatus.LEFT;

        return {
            becameLeft,
            participants: this.getPresence(session),
        };
    }
}
