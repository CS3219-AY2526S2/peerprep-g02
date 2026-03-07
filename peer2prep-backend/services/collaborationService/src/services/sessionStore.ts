import { randomUUID } from "node:crypto";

import type { CollaborationSession, CreateSessionRequest } from "@/types/session.js";

function pairKey(userAId: string, userBId: string): string {
    const [left, right] = [userAId, userBId].sort();
    return `${left}:${right}`;
}

class SessionStore {
    private readonly sessionsByPair = new Map<string, CollaborationSession>();

    createOrGetSession(payload: CreateSessionRequest): {
        session: CollaborationSession;
        created: boolean;
    } {
        const key = pairKey(payload.userAId, payload.userBId);
        const existingSession = this.sessionsByPair.get(key);

        if (existingSession && existingSession.status === "active") {
            return { session: existingSession, created: false };
        }

        const session: CollaborationSession = {
            sessionId: randomUUID(),
            userAId: payload.userAId,
            userBId: payload.userBId,
            difficulty: payload.difficulty,
            language: payload.language,
            status: "active",
            createdAt: new Date().toISOString(),
        };

        this.sessionsByPair.set(key, session);
        return { session, created: true };
    }
}

export const sessionStore = new SessionStore();
