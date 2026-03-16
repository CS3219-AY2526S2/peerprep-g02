export const SESSION_STATUS = {
    ACTIVE: "active",
    INACTIVE: "inactive",
} as const;

export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

export const SESSION_DIFFICULTY = {
    EASY: "Easy",
    MEDIUM: "Medium",
    HARD: "Hard",
} as const;

export type SessionDifficulty = (typeof SESSION_DIFFICULTY)[keyof typeof SESSION_DIFFICULTY];

export const SESSION_PARTICIPANT_STATUS = {
    CONNECTED: "connected",
    DISCONNECTED: "disconnected",
    LEFT: "left",
} as const;

export type SessionParticipantStatus =
    (typeof SESSION_PARTICIPANT_STATUS)[keyof typeof SESSION_PARTICIPANT_STATUS];

export const SESSION_ERROR = {
    INVALID_SESSION_REQUEST: "INVALID_SESSION_REQUEST",
    UNAUTHORIZED: "UNAUTHORIZED",
    USER_SERVICE_UNAVAILABLE: "USER_SERVICE_UNAVAILABLE",
    MATCH_USERS_NOT_ACTIVE: "MATCH_USERS_NOT_ACTIVE",
    QUESTION_SERVICE_UNAVAILABLE: "QUESTION_SERVICE_UNAVAILABLE",
    SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
    SESSION_NOT_ACTIVE: "SESSION_NOT_ACTIVE",
    FORBIDDEN_SESSION_ACCESS: "FORBIDDEN_SESSION_ACCESS",
    SESSION_CAPACITY_REACHED: "SESSION_CAPACITY_REACHED",
} as const;

export type SessionErrorCode = (typeof SESSION_ERROR)[keyof typeof SESSION_ERROR];

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

export type SessionParticipantStatuses = Record<string, SessionParticipantStatus>;

export type JoinSessionPayload = {
    sessionId?: string;
};

export type SessionEventErrorPayload = {
    error: SessionErrorCode;
    message: string;
};
