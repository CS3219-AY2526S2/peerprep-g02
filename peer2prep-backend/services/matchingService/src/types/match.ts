export type Difficulty = "Easy" | "Medium" | "Hard";

export const QUEUE_PREFIX = "mm:q";
export const USER_PREFIX = "mm:u";

export interface MatchRequest {
    userId: string;
    topic: string;
    difficulty: Difficulty;
    languages: string[];
}

export interface MatchResultSuccess {
    matchFound: true;
    matchId: string;
    matchedLanguage: string;
    partnerId: string;
}

export interface MatchResultWaiting {
    matchFound: false;
}

export type MatchResult = MatchResultSuccess | MatchResultWaiting;
