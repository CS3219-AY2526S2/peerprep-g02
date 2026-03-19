import { useState, useEffect } from "react";
import { matchingService } from "@/services/matching/matchingService";
import { Difficulty } from "@/models/question/questionType";

import { topicOptions, languageOptions } from "@/models/question/tempStubType";

import { Card } from "@/components/ui/card";
import MatchSearchingView from "./MatchSearchingView";
import MatchFormView from "./MatchFormView";

export function MatchingView() {
    const [topic, setTopic] = useState(topicOptions[0]);
    const [language, setLanguage] = useState(languageOptions[0]);
    const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.EASY);
    
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        const setupListeners = async () => {
            const socket = await matchingService.connect();

            socket.on("match_waiting", (data) => {
                console.log(data.message);
                setIsSearching(true);
            });

            socket.on("match_cancelled", (data) => {
                console.log(data.message);
                setIsSearching(false);
            });

            socket.on("match_error", (data) => {
                console.error("Match Error:", data.message);
                setIsSearching(false);
            });

            socket.on("match_success", (data) => {
                console.log("Partner found!", data);
                setIsSearching(false);
            });
        };

        setupListeners();

        return () => {
            matchingService.connect().then(socket => {
                socket.off("match_waiting");
                socket.off("match_cancelled");
                socket.off("match_error");
                socket.off("match_success");
            });
        };
    }, []);

    const handleFindMatch = async () => {
        setIsSearching(true);
        await matchingService.connect();
        matchingService.joinQueue({
            topic,
            difficulty,
            languages: [language],
        });
    };

    const handleCancelMatch = () => {
        matchingService.cancelQueue();
    };

    return (
        <Card className="overflow-hidden rounded-[30px] border border-white/70 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur relative transition-all duration-500">
            {isSearching ? (
                <MatchSearchingView 
                    topic={topic} 
                    language={language} 
                    difficulty={difficulty} 
                    onCancel={handleCancelMatch} 
                />
            ) : (
                <MatchFormView
                    topic={topic} setTopic={setTopic}
                    language={language} setLanguage={setLanguage}
                    difficulty={difficulty} setDifficulty={setDifficulty}
                    onFindMatch={handleFindMatch}
                />
            )}
        </Card>
    );
}
