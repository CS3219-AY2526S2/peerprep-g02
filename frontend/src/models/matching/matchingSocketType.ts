import { Difficulty } from "../question/questionType";

export const SocketEvents = {
    CONNECT: "connect",
    DISCONNECT: "disconnect",
    MATCH_WAITING: "match_waiting",
    MATCH_CANCELLED: "match_cancelled",
    MATCH_ERROR: "match_error",
    MATCH_PREPARING: "match_preparing",
    MATCH_SUCCESS: "match_success",
} as const;

export interface MatchResultPreparing {
    matchFound: true;
    matchId: string;
    matchedTopic: string;
    matchedDifficulty: Difficulty;
    matchedLanguage: string;
    userId: string;
    partnerId: string;
}

export interface MatchResultWaiting {
    matchFound: false;
    startTime: number;
    message: string;
}

export type MatchResult = MatchResultPreparing | MatchResultWaiting;

export interface RejoinResult {
    success: boolean;
    startTime: number | undefined;
}

export type MatchPreparingPayload = MatchResultPreparing;
export type MatchWaitingPayload = MatchResultWaiting;
export type MatchCancelledPayload = { message: string };
export type MatchErrorPayload = { message: string };

export type MatchSuccessPayload = {
    collaborationId: string;
    matchId?: string;
    userAId: string;
    userBId: string;
    difficulty: Difficulty;
    language: string;
    topic: string;
    questionId: string;
    status: string;
    createdAt: string;
};
