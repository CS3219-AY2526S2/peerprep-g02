export const SESSION_DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
export const SESSION_STATUSES = ["active", "inactive"] as const;

export type SessionDifficulty = (typeof SESSION_DIFFICULTIES)[number];
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export type CreateSessionRequest = {
    matchId?: string;
    userAId: string;
    userBId: string;
    difficulty: SessionDifficulty;
    language: string;
    topic: string;
};

export type UserValidationRecord = {
    userId: string;
    status: "active" | "inactive" | "suspended" | "deleted" | "unknown";
};

export type SelectedQuestion = {
    questionId: string;
    topic: string;
    difficulty: SessionDifficulty;
    title?: string;
};

export type CollaborationSession = {
    collaborationId: string;
    matchId?: string;
    userAId: string;
    userBId: string;
    difficulty: SessionDifficulty;
    language: string;
    topic: string;
    questionId: string;
    status: SessionStatus;
    createdAt: string;
};

export type SessionParticipantPresence = {
    userId: string;
    status: "online" | "offline";
    connectionCount: number;
};

export type SessionJoinState = {
    session: CollaborationSession;
    questionId: string;
    codeSnapshot: string;
    participants: SessionParticipantPresence[];
};
