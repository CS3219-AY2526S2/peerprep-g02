import { CollaborationSession, SessionStatus } from "@/models/models.js";

function pairKey(userAId: string, userBId: string): string {
    const [left, right] = [userAId, userBId].sort();
    return `${left}:${right}`;
}

export class SessionRepository {
    private readonly sessionsByPair = new Map<string, CollaborationSession>();
    private readonly sessionsById = new Map<string, CollaborationSession>();

    findActiveByUsers(userAId: string, userBId: string): CollaborationSession | null {
        const session = this.sessionsByPair.get(pairKey(userAId, userBId));
        if (!session || session.status !== SessionStatus.ACTIVE) {
            return null;
        }

        return session;
    }

    save(session: CollaborationSession): CollaborationSession {
        this.sessionsByPair.set(pairKey(session.userAId, session.userBId), session);
        this.sessionsById.set(session.sessionId, session);
        return session;
    }

    findById(sessionId: string): CollaborationSession | null {
        return this.sessionsById.get(sessionId) ?? null;
    }
}

export const sessionRepository = new SessionRepository();
