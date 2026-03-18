import { z } from "zod";

export const zDifficultySchema = z.enum(["Easy", "Medium", "Hard"]);
export type Difficulty = z.infer<typeof zDifficultySchema>;

export const MatchDetailsSchema = z.object({
    topic: z.string().min(1, "Topic is required"),
    difficulty: zDifficultySchema,
    languages: z.array(z.string()).min(1, "Select at least one language"),
});

export type MatchRequest = z.infer<typeof MatchDetailsSchema> & { userId: string };

export const QUEUE_PREFIX = "mm:q";
export const USER_STATUS_PREFIX = "mm:us";

export interface MatchResultSuccess {
    matchFound: true;
    matchId: string;
    matchedTopic: string;
    matchedDifficulty: Difficulty;
    matchedLanguage: string;
    userId: string;
    partnerId: string;
    collaborationSessionId: string;
}

export interface MatchResultWaiting {
    matchFound: false;
}

export type MatchResult = MatchResultSuccess | MatchResultWaiting;
