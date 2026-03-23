import { Difficulty } from "@/models/question/questionType";

export const getRelaxedDifficulties = (base: Difficulty, tier: number): Difficulty[] => {
    if (tier === 0) return [base];

    if (tier === 1) {
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
