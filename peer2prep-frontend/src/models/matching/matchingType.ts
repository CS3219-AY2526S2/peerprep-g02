import { Difficulty } from "../question/questionType";

export type MatchDetails = {
    topic: string;
    difficulty: Difficulty;
    languages: string[];
}

export const MATCH_EVENTS = {
    JOIN_QUEUE: "join_queue",
    CANCEL_QUEUE: "cancel_queue",
} as const;