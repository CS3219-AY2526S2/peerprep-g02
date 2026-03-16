import type { CollaborationSession, CreateSessionFromMatch } from "@/models/model.js";

class SessionStore {
    private readonly sessionsByMatch = new Map<string, CollaborationSession>();

    createOrGetSession(payload: CreateSessionFromMatch): {
        session: CollaborationSession;
        created: boolean;
        conflict: boolean;
    } {
        const existingSession = this.sessionsByMatch.get(payload.matchId);

        if (existingSession && existingSession.status === "active") {
            return {
                session: existingSession,
                created: false,
                conflict: false,
            };
        }

        const session: CollaborationSession = {
            sessionId: payload.matchId,
            matchId: payload.matchId,
            userAId: payload.userAId,
            userBId: payload.userBId,
            difficulty: payload.difficulty,
            language: payload.language,
            topic: payload.topic,
            status: "active",
            createdAt: new Date().toISOString(),
        };

        this.sessionsByMatch.set(payload.matchId, session);
        return { session, created: true, conflict: false };
    }
}

export const sessionStore = new SessionStore();
