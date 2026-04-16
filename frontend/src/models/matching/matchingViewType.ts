import { Language } from "@/models/matching/matchingDetailsType";
import { Difficulty } from "@/models/question/questionType";

export interface MatchFormViewProps {
    topicOptions: string[];
    languageOptions: readonly Language[];
    topics: string[];
    setTopics: (value: string[]) => void;
    languages: Language[];
    setLanguages: (value: Language[]) => void;
    difficulty: Difficulty;
    setDifficulty: (value: Difficulty) => void;
    onFindMatch: () => void;
    isLoading?: boolean;
    userScore: number | null;
}

export interface MatchSearchingViewProps {
    isPreparing: boolean;
    topics: string[];
    languages: Language[];
    difficulties: Difficulty[];
    relaxationTier: number;
    onCancel: () => void;
    isConnected: boolean;
}

export const TIER_METADATA: Record<number, { title: string; description: string }> = {
    0: {
        title: "Finding a Peer...",
        description: "Matching you with someone who has similar settings.",
    },
    1: {
        title: "Broadening Search...",
        description: "Expanding score range to find more potential peers.",
    },
    2: {
        title: "Widening Search...",
        description: "Further expanding the score range for a faster match.",
    },
    3: {
        title: "Relaxing Difficulty...",
        description: "Looking for peers in adjacent difficulty levels.",
    },
    4: {
        title: "Further Relaxing...",
        description: "Searching in all difficulty levels.",
    },
};
