export type AttemptHistoryItem = {
    id: string;
    clerkUserId: string;
    questionId: string;
    questionTitle: string;
    language: string;
    difficulty: "Easy" | "Medium" | "Hard";
    success: boolean;
    duration: number;
    totalTestCases: number;
    testCasesPassed: number;
    attemptedAt: string;
    createdAt: string;
};

export type AttemptHistoryResponse = {
    message: string;
    data?: {
        clerkUserId?: string;
        attempts?: AttemptHistoryItem[];
    };
    error?: string;
};
