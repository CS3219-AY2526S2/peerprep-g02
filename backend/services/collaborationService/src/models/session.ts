import type { UUID } from "node:crypto";

export const SESSION_DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
export const SESSION_STATUSES = ["active", "inactive"] as const;
export const PRESENCE_STATUSES = ["connected", "disconnected", "left"] as const;

export type SessionDifficulty = (typeof SESSION_DIFFICULTIES)[number];
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];

export type CreateSessionRequest = {
    matchId?: UUID;
    userAId: UUID;
    userBId: UUID;
    difficulty: SessionDifficulty;
    language: string;
    topic: string;
};

export type UserValidationRecord = {
    userId: UUID;
    status: "active" | "inactive" | "suspended" | "deleted" | "unknown";
    name?: string | null;
};

export type SelectedQuestion = {
    questionId: string;
    topic: string;
    difficulty: SessionDifficulty;
    title?: string;
    functionName?: string;
};

export type QuestionDetails = {
    quid: string;
    title: string;
    description: string;
    difficulty: string;
    topics: string[];
    testCase: Array<{ input: unknown; output: unknown }>;
    functionName: string;
    qnImage?: string | null;
};

export type CollaborationSession = {
    collaborationId: UUID;
    matchId?: UUID;
    userAId: UUID;
    userBId: UUID;
    difficulty: SessionDifficulty;
    language: string;
    topic: string;
    questionId: UUID;
    status: SessionStatus;
    createdAt: string;
};

export type SessionParticipantPresence = {
    userId: UUID;
    status: PresenceStatus;
    connectionCount: number;
};

export type SessionJoinState = {
    session: CollaborationSession;
    questionId: UUID;
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
    userId: UUID;
    revision: number;
    operations: OTOperation[];
};

export type RoomState = {
    collaborationId: UUID;
    questionId: UUID;
    code: string;
    codeRevision: number;
    language: string;
    output: string;
    participants: SessionParticipantPresence[];
};
