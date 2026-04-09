import { z } from "zod";

export const zDifficultySchema = z.enum(["Easy", "Medium", "Hard"]);
export type Difficulty = z.infer<typeof zDifficultySchema>;

export const MatchDetailsSchema = z.object({
    topics: z.array(z.string()).min(1, "Select at least one topic"),
    difficulties: z.array(zDifficultySchema).min(1, "Select at least one difficulty"),
    languages: z.array(z.string()).min(1, "Select at least one language"),
    userScore: z.number().int().nonnegative("Score must be a non-negative integer"),
    scoreRange: z.number().int().nonnegative("Score range must be a non-negative integer"),
    isUpdate: z.boolean().optional(),
});

export type MatchRequest = z.infer<typeof MatchDetailsSchema> & { userId: string };

export const QUEUE_PREFIX = "mm:q";
export const USER_STATUS_PREFIX = "mm:us";

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
}

export type MatchResult = MatchResultPreparing | MatchResultWaiting;

export interface RejoinResult {
    success: boolean;
    startTime: number | undefined;
}
