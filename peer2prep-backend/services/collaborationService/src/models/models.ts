export enum SessionStatus {
    ACTIVE = "active",
    ENDED = "ended",
}

export enum SessionDifficulty {
    EASY = "Easy",
    MEDIUM = "Medium",
    HARD = "Hard",
}

export enum SessionEventType {
    SESSION_CREATED = "collaboration.session.created",
}

export enum CreateSessionErrorCode {
    INVALID_SESSION_REQUEST = "INVALID_SESSION_REQUEST",
    AUTHENTICATION_VALIDATION_FAILED = "AUTHENTICATION_VALIDATION_FAILED",
    SERVICE_DEPENDENCY_ERROR = "SERVICE_DEPENDENCY_ERROR",
}

export type CreateSessionRequest = {
    userAId: string;
    userBId: string;
    difficulty: SessionDifficulty;
    language: string;
    topic: string;
};

export type AuthenticatedUser = {
    userId: string;
    isAuthenticated: boolean;
    status?: string;
};

export type QuestionSummary = {
    questionId: string;
};

export type CollaborationSession = {
    sessionId: string;
    userAId: string;
    userBId: string;
    difficulty: SessionDifficulty;
    language: string;
    topic: string;
    questionId: string;
    status: SessionStatus;
    createdAt: string;
};

export type CreateSessionResponse = {
    session: CollaborationSession;
    idempotentHit: boolean;
};
