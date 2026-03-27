import { Difficulty } from "../question/questionType";

export const SocketEvents = {
    CONNECT: "connect",
    DISCONNECT: "disconnect",
    MATCH_WAITING: "match_waiting",
    MATCH_CANCELLED: "match_cancelled",
    MATCH_ERROR: "match_error",
    MATCH_SUCCESS: "match_success",
} as const;

export interface MatchResultSuccess {
    matchFound: true;
    matchId: string;
    collaborationId: string;
    matchedTopic: string;
    matchedDifficulty: Difficulty;
    matchedLanguage: string;
    userId: string;
    partnerId: string;
}

export interface MatchResultWaiting {
    matchFound: false;
    startTime: string;
    message: string;
}

export type MatchResult = MatchResultSuccess | MatchResultWaiting;

export interface RejoinResult {
    success: boolean;
    startTime: number | undefined;
}

export type MatchSuccessPayload = MatchResultSuccess;
export type MatchWaitingPayload = MatchResultWaiting;
export type MatchCancelledPayload = { message: string };
export type MatchErrorPayload = { message: string };
