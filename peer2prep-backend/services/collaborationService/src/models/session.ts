export const SESSION_DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
export const SESSION_STATUSES = ["active", "inactive"] as const;
export const PRESENCE_STATUSES = ["connected", "disconnected", "left"] as const;

export type SessionDifficulty = (typeof SESSION_DIFFICULTIES)[number];
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];

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

export type QuestionDetails = {
    quid: string;
    title: string;
    description: string;
    difficulty: string;
    topics: string[];
    testCase: Array<{ input: string; output: string }>;
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
    status: PresenceStatus;
    connectionCount: number;
};

export type SessionJoinState = {
    session: CollaborationSession;
    questionId: string;
    question?: QuestionDetails;
    codeSnapshot: string;
    codeRevision: number;
    participants: SessionParticipantPresence[];
};

// OT Operation types
export type OTOperation = {
    type: "insert" | "delete" | "retain";
    position: number;
    text?: string;
    count?: number;
};

export type CodeChange = {
    userId: string;
    revision: number;
    operations: OTOperation[];
};

export type RoomState = {
    collaborationId: string;
    questionId: string;
    code: string;
    codeRevision: number;
    language: string;
    output: string;
    participants: SessionParticipantPresence[];
};
