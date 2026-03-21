export type CollaborationParticipant = {
    userId: string;
    status: "online" | "offline";
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
    codeSnapshot: string;
    participants: CollaborationParticipant[];
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
