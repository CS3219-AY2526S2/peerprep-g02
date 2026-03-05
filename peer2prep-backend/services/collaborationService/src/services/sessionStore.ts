import { randomUUID } from "node:crypto";

import type { CollaborationSession, CreateSessionRequest } from "@/types/session.js";

function pairKey(userAId: string, userBId: string): string {
    const [left, right] = [userAId, userBId].sort();
    return `${left}:${right}`;
}

export type CreateOrGetSessionResult =
    | { created: true; session: CollaborationSession }
    | { created: false; session: CollaborationSession }
    | { conflict: true; existingSession: CollaborationSession };

class SessionStore {
    private readonly sessionsByPair = new Map<string, CollaborationSession>();

    createOrGetSession(payload: CreateSessionRequest): CreateOrGetSessionResult {
        const key = pairKey(payload.userAId, payload.userBId);
        const existingSession = this.sessionsByPair.get(key);

        if (existingSession && existingSession.status === "active") {
            if (
                existingSession.difficulty !== payload.difficulty ||
                existingSession.language !== payload.language
            ) {
                return { conflict: true, existingSession };
            }
            return { created: false, session: existingSession };
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
        return { created: true, session };
    }
}

export const sessionStore = new SessionStore();
