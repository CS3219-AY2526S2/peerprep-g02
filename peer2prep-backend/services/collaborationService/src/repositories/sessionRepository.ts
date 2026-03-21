import { randomUUID } from "node:crypto";

import type { CollaborationSession, CreateSessionRequest } from "@/models/session.js";

function buildPairKey(userAId: string, userBId: string): string {
    const [left, right] = [userAId, userBId].sort();
    return `${left}:${right}`;
}

function buildIdempotencyKey(payload: CreateSessionRequest): string {
    return [
        payload.matchId?.trim() || buildPairKey(payload.userAId, payload.userBId),
        payload.difficulty,
        payload.language.trim().toLowerCase(),
        payload.topic.trim().toLowerCase(),
    ].join(":");
}

type CreateSessionInput = CreateSessionRequest & {
    questionId: string;
};

type CreateSessionResult =
    | {
          session: CollaborationSession;
          created: true;
          idempotentHit: false;
          conflict: false;
      }
    | {
          session: CollaborationSession;
          created: false;
          idempotentHit: true;
          conflict: false;
      }
    | {
          session: CollaborationSession;
          created: false;
          idempotentHit: false;
          conflict: true;
      };

export class SessionRepository {
    private readonly sessionsByIdempotencyKey = new Map<string, CollaborationSession>();
    private readonly activeSessionsByPair = new Map<string, CollaborationSession>();
    private readonly sessionsByCollaborationId = new Map<string, CollaborationSession>();
    private readonly codeSnapshotsByCollaborationId = new Map<string, string>();

    createActiveSession(input: CreateSessionInput): CreateSessionResult {
        const pairKey = buildPairKey(input.userAId, input.userBId);
        const idempotencyKey = buildIdempotencyKey(input);

        const existingByIdempotencyKey = this.sessionsByIdempotencyKey.get(idempotencyKey);
        if (existingByIdempotencyKey?.status === "active") {
            return {
                session: existingByIdempotencyKey,
                created: false,
                idempotentHit: true,
                conflict: false,
            };
        }

        const activeSessionForPair = this.activeSessionsByPair.get(pairKey);
        if (activeSessionForPair?.status === "active") {
            return {
                session: activeSessionForPair,
                created: false,
                idempotentHit: false,
                conflict: true,
            };
        }

        const session: CollaborationSession = {
            collaborationId: randomUUID(),
            matchId: input.matchId,
            userAId: input.userAId,
            userBId: input.userBId,
            difficulty: input.difficulty,
            language: input.language,
            topic: input.topic,
            questionId: input.questionId,
            status: "active",
            createdAt: new Date().toISOString(),
        };

        this.sessionsByIdempotencyKey.set(idempotencyKey, session);
        this.activeSessionsByPair.set(pairKey, session);
        this.sessionsByCollaborationId.set(session.collaborationId, session);
        this.codeSnapshotsByCollaborationId.set(session.collaborationId, "");

        return {
            session,
            created: true,
            idempotentHit: false,
            conflict: false,
        };
    }

    getSessionByCollaborationId(collaborationId: string): CollaborationSession | null {
        return this.sessionsByCollaborationId.get(collaborationId) ?? null;
    }

    getCodeSnapshot(collaborationId: string): string {
        return this.codeSnapshotsByCollaborationId.get(collaborationId) ?? "";
    }
}
