import { SCORE_RANGE } from "@/models/matching/matchingDetailsType";
import { Difficulty } from "@/models/question/questionType";

export const getRelaxedDifficulties = (base: Difficulty, tier: number): Difficulty[] => {
    if (tier <= 2) return [base];

    if (tier === 3) {
        switch (base) {
            case Difficulty.EASY:
                return [Difficulty.EASY, Difficulty.MEDIUM];
            case Difficulty.MEDIUM:
                return [Difficulty.EASY, Difficulty.MEDIUM];
            case Difficulty.HARD:
                return [Difficulty.MEDIUM, Difficulty.HARD];
            default:
                return [base];
        }
    }

    return [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD];
};

export const getRelaxedRange = (tier: number): number => {
    switch (tier) {
        case 0:
            return SCORE_RANGE.DEFAULT;
        case 1:
            return SCORE_RANGE.RELAXED_1;
        case 2:
            return SCORE_RANGE.RELAXED_2;
        case 3:
            return SCORE_RANGE.RELAXED_3;
        case 4:
            return SCORE_RANGE.RELAXED_4;
        default:
            return SCORE_RANGE.DEFAULT;
    }
};
