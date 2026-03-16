export type SessionStatus = "active" | "inactive";
export type SessionDifficulty = "Easy" | "Medium" | "Hard";

export type CreateSessionRequest = {
    matchId: string;
};

export type CreateSessionFromMatch = {
    matchId: string;
    userAId: string;
    userBId: string;
    difficulty: SessionDifficulty;
    language: string;
    topic: string;
};

export type CollaborationSession = {
    sessionId: string;
    matchId: string;
    userAId: string;
    userBId: string;
    difficulty: SessionDifficulty;
    language: string;
    topic: string;
    status: SessionStatus;
    createdAt: string;
};
