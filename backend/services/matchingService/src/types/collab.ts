import type { Difficulty } from "./match.js";

export type CreateSessionRequest = {
    matchId: string;
    userAId: string;
    userBId: string;
    difficulty: string;
    language: string;
    topic: string;
};

export type CreateSessionResponse = {
    session: {
        collaborationId: string;
        matchId?: string;
        userAId: string;
        userBId: string;
        difficulty: Difficulty;
        language: string;
        topic: string;
        questionId: string;
        status: string;
        createdAt: string;
    };
    idempotentHit: boolean;
    cacheWriteSucceeded: boolean;
};

export type CollaborationSuccessPayload = {
    matchFound: true;
    matchId?: string;
    collaborationId: string;
    matchedTopic: string;
    matchedDifficulty: Difficulty;
    matchedLanguage: string;
    userId: string;
    partnerId: string;
};
