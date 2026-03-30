import { useEffect, useRef, useState } from "react";

import { Socket } from "socket.io-client";

import { getRelaxedDifficulties } from "@/utils/matching/matchingUtils";
import { pushToast } from "@/utils/toast";
import {
    MatchCancelledPayload,
    MatchErrorPayload,
    MatchWaitingPayload,
    SocketEvents,
} from "@/models/matching/matchingSocketType";
import { Difficulty } from "@/models/question/questionType";

import { matchingService } from "@/services/matching/matchingService";

type MatchSuccessPayload = {
    collaborationId?: string;
    matchId?: string;
    matchedTopic?: string;
    matchedDifficulty?: string;
    matchedLanguage?: string;
    userId?: string;
    partnerId?: string;
};

export function useMatchingQueue(
    topic: string,
    language: string,
    difficulty: Difficulty,
    onMatchFound?: (payload: MatchSuccessPayload) => void,
) {
    const [isSearching, setIsSearching] = useState(false);
    const [activeTier, setActiveTier] = useState(0);

    const searchStartTime = useRef<number | null>(null);
    const relaxationTier = useRef(0);
    const isSearchingRef = useRef(false);

    // Store callback in ref to avoid effect re-runs when callback identity changes
    const onMatchFoundRef = useRef(onMatchFound);
    useEffect(() => {
        onMatchFoundRef.current = onMatchFound;
    }, [onMatchFound]);

    useEffect(() => {
        isSearchingRef.current = isSearching;
    }, [isSearching]);

    useEffect(() => {
        let socketInstance: Socket | null = null;

        const setupListeners = async () => {
            socketInstance = await matchingService.connect();

            socketInstance.on(SocketEvents.CONNECT, () => {
                if (isSearchingRef.current) {
                    matchingService.joinQueue({
                        topic,
                        difficulties: [difficulty],
                        languages: [language],
                    });
                }
            });

            socketInstance.on(SocketEvents.MATCH_WAITING, (data: MatchWaitingPayload) => {
                setIsSearching(true);
                if (data.startTime) searchStartTime.current = parseInt(data.startTime, 10);
            });

            const resetSearchState = () => {
                setIsSearching(false);
                searchStartTime.current = null;
                relaxationTier.current = 0;
                setActiveTier(0);
            };

            socketInstance.on(SocketEvents.MATCH_CANCELLED, (_data: MatchCancelledPayload) => {
                resetSearchState();
            });

            socketInstance.on(SocketEvents.MATCH_ERROR, (_data: MatchErrorPayload) => {
                resetSearchState();
            });

            socketInstance.on(SocketEvents.MATCH_SUCCESS, (data: MatchSuccessPayload) => {
                resetSearchState();

                if (data.collaborationId && onMatchFoundRef.current) {
                    onMatchFoundRef.current(data);
                    return;
                }

                pushToast({
                    tone: "info",
                    message:
                        "Match found. Waiting for collaboration session routing to become available.",
                    durationMs: 4500,
                });
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
    }, [topic, language, difficulty]);

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
                    upgradeTier(1);
                } else if (secondsPassed >= 30 && relaxationTier.current === 1) {
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
