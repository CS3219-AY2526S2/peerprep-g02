import type { ExecutionResponse } from "@/services/executionService.js";

export const EXEC_REQ_QUEUE = "exec_req_queue";
export const EXEC_RES_QUEUE = "exec_res_queue";

export type ExecutionRequestMessage = {
    correlationId: string;
    collaborationId: string;
    userId: string;
    type: "run" | "submit";

    code: string;
    language: string;
    functionName: string;
    testCases: Array<{ input: unknown; output: unknown }>;

    questionId: string;
    questionTitle: string;
    difficulty: string;
    sessionCreatedAt: string;
};

export type ExecutionResponseMessage = {
    correlationId: string;
    collaborationId: string;
    userId: string;
    type: "run" | "submit";

    questionId: string;
    questionTitle: string;
    language: string;
    difficulty: string;
    sessionCreatedAt: string;

    success: boolean;
    result?: ExecutionResponse;
    error?: string;
};
