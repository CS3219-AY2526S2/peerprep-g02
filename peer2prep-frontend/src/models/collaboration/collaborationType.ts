export type PresenceStatus = "connected" | "disconnected" | "left";

export type CollaborationParticipant = {
    userId: string;
    status: PresenceStatus;
    connectionCount: number;
};

export type CollaborationSession = {
    collaborationId: string;
    matchId?: string;
    userAId: string;
    userBId: string;
    difficulty: "Easy" | "Medium" | "Hard";
    language: string;
    topic: string;
    questionId: string;
    status: "active" | "inactive";
    createdAt: string;
};

export type CollaborationJoinState = {
    session: CollaborationSession;
    questionId: string;
    question?: CollaborationQuestion;
    codeSnapshot: string;
    codeRevision: number;
    participants: CollaborationParticipant[];
    isFirstConnection: boolean;
    wasDisconnected: boolean;
    disconnectDurationMs: number;
};

// OT Operation types
export type OTOperationType = "insert" | "delete" | "retain";

export type OTOperation = {
    type: OTOperationType;
    position: number;
    text?: string;
    count?: number;
};

export type CodeChangePayload = {
    collaborationId: string;
    userId: string;
    revision: number;
    operations: OTOperation[];
};

export type CodeSyncPayload = {
    collaborationId: string;
    code: string;
    revision: number;
};

export type UserJoinedPayload = {
    collaborationId: string;
    userId: string;
    isFirstConnection: boolean;
    wasDisconnected: boolean;
};

export type UserDisconnectedPayload = {
    collaborationId: string;
    userId: string;
    reason?: string;
};

export type UserLeftPayload = {
    collaborationId: string;
    userId: string;
};

export type OutputUpdatedPayload = {
    collaborationId: string;
    output: string;
};

export type RoomState = {
    collaborationId: string;
    questionId: string;
    code: string;
    codeRevision: number;
    language: string;
    output: string;
    participants: CollaborationParticipant[];
};

export type SessionEndedPayload = {
    collaborationId: string;
    reason: "both_users_left" | "inactivity_timeout" | "manual";
};

export type CollaborationQuestion = {
    quid: string;
    title: string;
    topics: string[];
    difficulty: string;
    description: string;
    testCase: Array<{
        input: string;
        output: string;
    }>;
};
