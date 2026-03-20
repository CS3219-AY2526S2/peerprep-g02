import { useState, useEffect, useRef } from "react";
import { matchingService } from "@/services/matching/matchingService";
import { getRelaxedDifficulties } from "@/utils/matching/matchingUtils";
import { SocketEvents } from "@/models/matching/matchingSocketType";
import { Difficulty } from "@/models/question/questionType";

export function useMatchingQueue(topic: string, language: string, difficulty: Difficulty) {
    const [isSearching, setIsSearching] = useState(false);
    const [activeTier, setActiveTier] = useState(0);
    
    const searchStartTime = useRef<number | null>(null);
    const relaxationTier = useRef(0);
    const isSearchingRef = useRef(false);

    useEffect(() => {
        isSearchingRef.current = isSearching;
    }, [isSearching]);

    useEffect(() => {
        let socketInstance: any = null;

        const setupListeners = async () => {
            socketInstance = await matchingService.connect();

            socketInstance.on(SocketEvents.CONNECT, () => {
                if (isSearchingRef.current) {
                    console.log("Reconnected! Rejoining queue...");
                    matchingService.joinQueue({
                        topic,
                        difficulties: [difficulty],
                        languages: [language],
                    });
                }
            });

            socketInstance.on(SocketEvents.MATCH_WAITING, (data: any) => {
                setIsSearching(true);
                if (data.startTime) searchStartTime.current = parseInt(data.startTime, 10);
            });

            const resetSearchState = () => {
                setIsSearching(false);
                searchStartTime.current = null;
                relaxationTier.current = 0;
                setActiveTier(0);
            };

            socketInstance.on(SocketEvents.MATCH_CANCELLED, (data: any) => {
                console.log(data.message);
                resetSearchState();
            });

            socketInstance.on(SocketEvents.MATCH_ERROR, (data: any) => {
                console.error("Match Error:", data.message);
                resetSearchState();
            });

            socketInstance.on(SocketEvents.MATCH_SUCCESS, (data: any) => {
                console.log("Partner found!", data);
                resetSearchState();
            });
        };

        setupListeners();

        return () => {
            if (socketInstance) {
                socketInstance.off(SocketEvents.CONNECT);
                socketInstance.off(SocketEvents.MATCH_WAITING);
                socketInstance.off(SocketEvents.MATCH_CANCELLED);
                socketInstance.off(SocketEvents.MATCH_ERROR);
                socketInstance.off(SocketEvents.MATCH_SUCCESS);
            }
        };
    }, [topic, language, difficulty]); // Added dependencies so it knows about current state

    // 2. Relaxation Timer Logic
    useEffect(() => {
        let relaxationTimer: NodeJS.Timeout;

        if (isSearching) {
            relaxationTimer = setInterval(() => {
                if (!searchStartTime.current) return;

                const secondsPassed = (Date.now() - searchStartTime.current) / 1000;

                const upgradeTier = (newTier: number) => {
                    relaxationTier.current = newTier;
                    setActiveTier(newTier);
                    matchingService.joinQueue({
                        topic,
                        difficulties: getRelaxedDifficulties(difficulty, newTier),
                        languages: [language],
                        isUpdate: true,
                    });
                };

                if (secondsPassed >= 15 && relaxationTier.current === 0) {
                    console.log("15s passed: Relaxing search criteria!");
                    upgradeTier(1);
                } else if (secondsPassed >= 30 && relaxationTier.current === 1) {
                    console.log("30s passed: Max relaxation!");
                    upgradeTier(2);
                }
            }, 1000);
        }

        return () => clearInterval(relaxationTimer);
    }, [isSearching, topic, difficulty, language]);

    const startSearch = async () => {
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

    const cancelSearch = () => {
        matchingService.cancelQueue();
    };

    return { isSearching, activeTier, startSearch, cancelSearch };
}
