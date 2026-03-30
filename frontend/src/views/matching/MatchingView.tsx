import { startTransition, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Card } from "@/components/ui/card";

import { collaborationRoute } from "@/constants/routes";
import { getRelaxedDifficulties } from "@/utils/matching/matchingUtils";
import { Difficulty } from "@/models/question/questionType";
import { languageOptions, topicOptions } from "@/models/question/tempStubType";

import MatchFormView from "@/views/matching/MatchFormView";
import MatchSearchingView from "@/views/matching/MatchSearchingView";

import { useMatchingQueue } from "@/services/matching/useMatchingQueue";

export function MatchingView() {
    const navigate = useNavigate();
    const [topics, setTopics] = useState<string[]>([topicOptions[0]]);
    const [languages, setLanguages] = useState<string[]>([languageOptions[0]]);
    const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.EASY);

    const { isSearching, activeTier, startSearch, cancelSearch, userScore, isConnected } =
        useMatchingQueue(topics, languages, difficulty, (payload) => {
            if (!payload.collaborationId) {
                return;
            }

            startTransition(() => {
                navigate(collaborationRoute(payload.collaborationId));
            });
        });

    return (
        <Card className="overflow-hidden rounded-[30px] border border-white/70 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur relative transition-all duration-500">
            {isSearching ? (
                <MatchSearchingView
                    topics={topics}
                    languages={languages}
                    difficulties={getRelaxedDifficulties(difficulty, activeTier)}
                    relaxationTier={activeTier}
                    onCancel={cancelSearch}
                    isConnected={isConnected}
                />
            ) : (
                <MatchFormView
                    topics={topics}
                    setTopics={setTopics}
                    userScore={userScore}
                    languages={languages}
                    setLanguages={setLanguages}
                    difficulty={difficulty}
                    setDifficulty={setDifficulty}
                    onFindMatch={startSearch}
                />
            )}
        </Card>
    );
}
