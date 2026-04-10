export type AiHint = {
    userId: string;
    hint: string;
    timestamp: number;
};

export type HintRequestAck = {
    ok: boolean;
    hints?: AiHint[];
    hintsRemaining?: number;
    error?: string;
};

export type HintUpdatedPayload = {
    collaborationId: string;
    hints: AiHint[];
    requestedBy: string;
};
