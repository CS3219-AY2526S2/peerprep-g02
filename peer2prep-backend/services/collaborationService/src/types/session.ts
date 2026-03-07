export type SessionStatus = "active" | "inactive";

export type CreateSessionRequest = {
    userAId: string;
    userBId: string;
    difficulty: string;
    language: string;
};

export type CollaborationSession = {
    sessionId: string;
    userAId: string;
    userBId: string;
    difficulty: string;
    language: string;
    status: SessionStatus;
    createdAt: string;
};
