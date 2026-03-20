import { Difficulty } from "@/models/question/questionType";

export type MatchDetails = {
    topic: string;
    difficulties: Difficulty[];
    languages: string[];
    isUpdate?: boolean;
};

export const MATCH_EVENTS = {
    JOIN_QUEUE: "join_queue",
    CANCEL_QUEUE: "cancel_queue",
} as const;
