import { useState } from "react";
import { Difficulty } from "@/models/question/questionType";
import { topicOptions, languageOptions } from "@/models/question/tempStubType";
import { Card } from "@/components/ui/card";
import MatchSearchingView from "@/views/matching/MatchSearchingView";
import MatchFormView from "@/views/matching/MatchFormView";
import { getRelaxedDifficulties } from "@/utils/matching/matchingUtils";
import { useMatchingQueue } from "@/services/matching/useMatchingQueue";

export function MatchingView() {
    const [topic, setTopic] = useState(topicOptions[0]);
    const [language, setLanguage] = useState(languageOptions[0]);
    const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.EASY);

    const { 
        isSearching, 
        activeTier, 
        startSearch, 
        cancelSearch 
    } = useMatchingQueue(topic, language, difficulty);

    return (
        <Card className="overflow-hidden rounded-[30px] border border-white/70 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur relative transition-all duration-500">
            {isSearching ? (
                <MatchSearchingView
                    topic={topic}
                    languages={[language]}
                    difficulties={getRelaxedDifficulties(difficulty, activeTier)}
                    relaxationTier={activeTier}
                    onCancel={cancelSearch}
                />
            ) : (
                <MatchFormView
                    topic={topic}
                    setTopic={setTopic}
                    language={language}
                    setLanguage={setLanguage}
                    difficulty={difficulty}
                    setDifficulty={setDifficulty}
                    onFindMatch={startSearch}
                />
            )}
        </Card>
    );
}
