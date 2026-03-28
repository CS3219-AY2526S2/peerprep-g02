export type AttemptHistoryItem = {
    id: string;
    clerkUserId: string;
    questionId: string;
    language: string;
    difficulty: "Easy" | "Medium" | "Hard";
    success: boolean;
    duration: number;
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
