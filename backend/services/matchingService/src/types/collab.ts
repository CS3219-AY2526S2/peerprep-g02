import type { Difficulty } from "./match.js";

export type CreateSessionRequest = {
    matchId: string;
    userAId: string;
    userBId: string;
    difficulty: Difficulty;
    language: string;
    topicId: string;
};

export type CreateSessionResponse = {
    session: {
        collaborationId: string;
        matchId?: string;
        userAId: string;
        userBId: string;
        difficulty: Difficulty;
        language: string;
        topicId: string;
        questionId: string;
        status: string;
        createdAt: string;
    };
    idempotentHit: boolean;
    cacheWriteSucceeded: boolean;
};

export type CreateSessionFailure = {
    error: true;
    userAId: string;
    userBId: string;
    message: string;
};

export type CollaborationSuccessPayload = {
    matchFound: true;
    matchId?: string;
    collaborationId: string;
    matchedTopicId: string;
    matchedDifficulty: Difficulty;
    matchedLanguage: string;
    userId: string;
    partnerId: string;
};
