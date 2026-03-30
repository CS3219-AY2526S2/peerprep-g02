import { Difficulty } from "@/models/question/questionType";

export type MatchDetails = {
    topics: string[];
    difficulties: Difficulty[];
    languages: string[];
    userScore: number;
    scoreRange: number;
    isUpdate?: boolean;
};

export const MATCH_EVENTS = {
    JOIN_QUEUE: "join_queue",
    CANCEL_QUEUE: "cancel_queue",
} as const;

export const SCORE_RANGE = {
    DEFAULT: 50,
    RELAXED_1: 100,
    RELAXED_2: 200,
    RELAXED_3: 300,
    RELAXED_4: 400,
};
