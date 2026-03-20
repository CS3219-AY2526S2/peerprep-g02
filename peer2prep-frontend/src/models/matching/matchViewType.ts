import { Difficulty } from "@/models/question/questionType";

export interface MatchFormViewProps {
    topic: string;
    setTopic: (value: string) => void;
    language: string;
    setLanguage: (value: string) => void;
    difficulty: Difficulty;
    setDifficulty: (value: Difficulty) => void;
    onFindMatch: () => void;
    isLoading?: boolean;
}

export interface MatchSearchingViewProps {
    topic: string;
    languages: string[];
    difficulties: string[];
    relaxationTier: number;
    onCancel: () => void;
}
