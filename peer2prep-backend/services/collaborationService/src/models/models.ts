/** Defines shared enums and data models used across the collaboration service. */
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

export enum SessionParticipantStatus {
    CONNECTED = "connected",
    DISCONNECTED = "disconnected",
    LEFT = "left",
}

export enum CreateSessionErrorCode {
    INVALID_SESSION_REQUEST = "INVALID_SESSION_REQUEST",
    AUTHENTICATION_VALIDATION_FAILED = "AUTHENTICATION_VALIDATION_FAILED",
    SERVICE_DEPENDENCY_ERROR = "SERVICE_DEPENDENCY_ERROR",
}

export enum JoinSessionErrorCode {
    INVALID_JOIN_REQUEST = "INVALID_JOIN_REQUEST",
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND",
    SESSION_NOT_ACTIVE = "SESSION_NOT_ACTIVE",
    USER_NOT_ASSIGNED_TO_SESSION = "USER_NOT_ASSIGNED_TO_SESSION",
    UNAUTHENTICATED_USER = "UNAUTHENTICATED_USER",
    SERVICE_DEPENDENCY_ERROR = "SERVICE_DEPENDENCY_ERROR",
}

export enum SessionRealtimeEvent {
    SESSION_JOINED = "session:joined",
    SESSION_PEER_JOINED = "session:peer-joined",
    SESSION_PEER_DISCONNECTED = "session:peer-disconnected",
    SESSION_PEER_LEFT = "session:peer-left",
    SESSION_ERROR = "session:error",
}

export type CreateSessionRequest = {
    matchId: string;
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
    matchId: string;
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

export type SessionParticipantPresence = {
    userId: string;
    status: SessionParticipantStatus;
};

export type JoinSessionResponse = {
    session: CollaborationSession;
    currentUserId: string;
    participants: SessionParticipantPresence[];
};

export type UserAuthorizationContext = {
    clerkUserId: string;
    status?: string;
    role?: string;
};
