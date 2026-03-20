import { useState, useEffect, useRef } from "react";
import { matchingService } from "@/services/matching/matchingService";
import { Difficulty } from "@/models/question/questionType";
import { topicOptions, languageOptions } from "@/models/question/tempStubType";
import { Card } from "@/components/ui/card";
import MatchSearchingView from "@/views/matching/MatchSearchingView";
import MatchFormView from "@/views/matching/MatchFormView";
import { getRelaxedDifficulties } from "@/utils/matching/matchingUtils";

export function MatchingView() {
    const [topic, setTopic] = useState(topicOptions[0]);
    const [language, setLanguage] = useState(languageOptions[0]);
    const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.EASY);

    const [isSearching, setIsSearching] = useState(false);

    const searchStartTime = useRef<number | null>(null);
    const isSearchingRef = useRef(false);

    const [activeTier, setActiveTier] = useState(0);
    const relaxationTier = useRef(0);

    useEffect(() => {
        isSearchingRef.current = isSearching;
    }, [isSearching]);

    useEffect(() => {
        let socketInstance: any = null;

        const setupListeners = async () => {
            socketInstance = await matchingService.connect();

            socketInstance.on("connect", () => {
                if (isSearchingRef.current) {
                    console.log("Reconnected! Rejoining queue...");
                    matchingService.joinQueue({
                        topic,
                        difficulties: [difficulty],
                        languages: [language],
                    });
                }
            });

            socketInstance.on("match_waiting", (data: any) => {
                setIsSearching(true);
                if (data.startTime) {
                    searchStartTime.current = parseInt(data.startTime, 10);
                }
            });

            socketInstance.on("match_cancelled", (data: any) => {
                console.log(data.message);
                setIsSearching(false);
                searchStartTime.current = null;
                relaxationTier.current = 0;
                setActiveTier(0);
            });

            socketInstance.on("match_error", (data: any) => {
                console.error("Match Error:", data.message);
                setIsSearching(false);
                searchStartTime.current = null;
                relaxationTier.current = 0;
                setActiveTier(0);
            });

            socketInstance.on("match_success", (data: any) => {
                console.log("Partner found!", data);
                setIsSearching(false);
                searchStartTime.current = null;
                relaxationTier.current = 0;
                setActiveTier(0);
            });
        };

        setupListeners();

        return () => {
            if (socketInstance) {
                socketInstance.off("connect");
                socketInstance.off("match_waiting");
                socketInstance.off("match_cancelled");
                socketInstance.off("match_error");
                socketInstance.off("match_success");
            }
        };
    }, []);

    useEffect(() => {
        let relaxationTimer: NodeJS.Timeout;

        if (isSearching) {
            relaxationTimer = setInterval(() => {
                if (!searchStartTime.current) return;

                const secondsPassed = (Date.now() - searchStartTime.current) / 1000;

                if (secondsPassed >= 15 && relaxationTier.current === 0) {
                    console.log("15s passed: Relaxing search criteria!");
                    relaxationTier.current = 1;
                    setActiveTier(1);

                    matchingService.joinQueue({
                        topic,
                        difficulties: getRelaxedDifficulties(difficulty, relaxationTier.current),
                        languages: [language],
                        isUpdate: true,
                    });
                }

                if (secondsPassed >= 30 && relaxationTier.current === 1) {
                    console.log("30s passed: Max relaxation!");
                    relaxationTier.current = 2;
                    setActiveTier(2);

                    matchingService.joinQueue({
                        topic,
                        difficulties: getRelaxedDifficulties(difficulty, relaxationTier.current),
                        languages: [language],
                        isUpdate: true,
                    });
                }
            }, 1000);
        }

        return () => {
            clearInterval(relaxationTimer);
        };
    }, [isSearching, topic, difficulty, language]);

    const handleFindMatch = async () => {
        setIsSearching(true);
        relaxationTier.current = 0;
        setActiveTier(0);
        searchStartTime.current = Date.now();

        await matchingService.connect();
        matchingService.joinQueue({
            topic,
            difficulties: [difficulty],
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
                    languages={[language]}
                    difficulties={getRelaxedDifficulties(difficulty, activeTier)}
                    relaxationTier={activeTier}
                    onCancel={handleCancelMatch}
                />
            ) : (
                <MatchFormView
                    topic={topic}
                    setTopic={setTopic}
                    language={language}
                    setLanguage={setLanguage}
                    difficulty={difficulty}
                    setDifficulty={setDifficulty}
                    onFindMatch={handleFindMatch}
                />
            )}
        </Card>
    );
}
