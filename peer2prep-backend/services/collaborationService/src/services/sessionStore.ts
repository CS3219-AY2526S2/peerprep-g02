import { randomUUID } from "node:crypto";

import type { CollaborationSession, CreateSessionRequest } from "@/models/model.js";

function pairKey(userAId: string, userBId: string): string {
    const [left, right] = [userAId, userBId].sort();
    return `${left}:${right}`;
}

class SessionStore {
    private readonly sessionsByPair = new Map<string, CollaborationSession>();

    createOrGetSession(payload: CreateSessionRequest): {
        session: CollaborationSession;
        created: boolean;
        conflict: boolean;
    } {
        const key = pairKey(payload.userAId, payload.userBId);
        const existingSession = this.sessionsByPair.get(key);

        if (existingSession && existingSession.status === "active") {
            const hasConflict =
                existingSession.difficulty !== payload.difficulty ||
                existingSession.language !== payload.language ||
                existingSession.topic !== payload.topic;

            return {
                session: existingSession,
                created: false,
                conflict: hasConflict,
            };
        }

        const session: CollaborationSession = {
            sessionId: randomUUID(),
            userAId: payload.userAId,
            userBId: payload.userBId,
            difficulty: payload.difficulty,
            language: payload.language,
            topic: payload.topic,
            status: "active",
            createdAt: new Date().toISOString(),
        };

        this.sessionsByPair.set(key, session);
        return { session, created: true, conflict: false };
    }
}

export const sessionStore = new SessionStore();
