export type SessionStatus = "active" | "inactive";
export type SessionDifficulty = "Easy" | "Medium" | "Hard";

export type CreateSessionRequest = {
    userAId: string;
    userBId: string;
    difficulty: SessionDifficulty;
    language: string;
    topic: string;
};

export type CollaborationSession = {
    sessionId: string;
    pairKey: string;
    userAId: string;
    userBId: string;
    difficulty: SessionDifficulty;
    language: string;
    topic: string;
    questionId: string;
    status: SessionStatus;
    createdAt: string;
};
