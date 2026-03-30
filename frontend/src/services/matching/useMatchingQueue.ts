import { useEffect, useRef, useState } from "react";

import { Socket } from "socket.io-client";

import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import { apiFetch } from "@/utils/apiClient";
import { getRelaxedDifficulties, getRelaxedRange } from "@/utils/matching/matchingUtils";
import { pushToast } from "@/utils/toast";
import { SCORE_RANGE } from "@/models/matching/matchingDetailsType";
import {
    MatchCancelledPayload,
    MatchErrorPayload,
    MatchSuccessPayload,
    MatchWaitingPayload,
    SocketEvents,
} from "@/models/matching/matchingSocketType";
import { Difficulty } from "@/models/question/questionType";

import { matchingService } from "@/services/matching/matchingService";

export function useMatchingQueue(
    topic: string,
    language: string,
    difficulty: Difficulty,
    onMatchFound?: (payload: MatchSuccessPayload) => void,
) {
    const [isConnected, setIsConnected] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [activeTier, setActiveTier] = useState(0);

    const [userScore, setUserScore] = useState<number | null>(null);

    const searchStartTime = useRef<number | null>(null);
    const relaxationTier = useRef(0);
    const isSearchingRef = useRef(false);

    const cancelSearch = () => {
        matchingService.cancelQueue();
    };

    const onMatchFoundRef = useRef(onMatchFound);

    useEffect(() => {
        const fetchScore = async () => {
            try {
                const response = await apiFetch(API_ENDPOINTS.USERS.ME);

                if (!response.ok) {
                    console.error(`Error ${response.status}: Failed to fetch profile`);
                    return;
                }

                const payload = await response.json();
                const score = payload?.data?.user?.score;

                if (score !== undefined) {
                    setUserScore(score);
                }
            } catch (error) {
                pushToast({
                    tone: "error",
                    message: "Unable to fetch user score.",
                });
            }
        };
        fetchScore();
    }, []);

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
            setIsConnected(socketInstance.connected);

            socketInstance.on(SocketEvents.CONNECT, () => {
                if (userScore === null) {
                    pushToast({
                        tone: "error",
                        message: "Still loading your profile. Please try again in a moment.",
                    });
                    return;
                }
                setIsConnected(true);
                if (isSearchingRef.current) {
                    matchingService.joinQueue({
                        topic,
                        difficulties: [difficulty],
                        languages: [language],
                        userScore: userScore,
                        scoreRange: SCORE_RANGE.DEFAULT,
                    });
                }
            });

            socketInstance.on(SocketEvents.DISCONNECT, () => {
                console.log("Socket disconnected.");
                setIsConnected(false);
            });

            socketInstance.on(SocketEvents.MATCH_WAITING, (data: MatchWaitingPayload) => {
                console.log(data.message);
                setIsSearching(true);
                if (data.startTime) searchStartTime.current = data.startTime;
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
                socketInstance.off(SocketEvents.DISCONNECT);
            }
        };
    }, [topic, language, difficulty, userScore]);

    // 2. Relaxation Timer Logic
    useEffect(() => {
        let relaxationTimer: NodeJS.Timeout;

        if (isSearching && isConnected) {
            relaxationTimer = setInterval(() => {
                if (!searchStartTime.current) return;

                const secondsPassed = (Date.now() - searchStartTime.current) / 1000;

                const upgradeTier = (newTier: number) => {
                    if (userScore === null) {
                        pushToast({
                            tone: "error",
                            message: "Still loading your profile. Please try again in a moment.",
                        });
                        return;
                    }
                    relaxationTier.current = newTier;
                    setActiveTier(newTier);
                    matchingService.joinQueue({
                        topic,
                        difficulties: getRelaxedDifficulties(difficulty, newTier),
                        languages: [language],
                        userScore: userScore,
                        scoreRange: getRelaxedRange(newTier),
                        isUpdate: true,
                    });
                };
                if (secondsPassed >= 12 && relaxationTier.current === 0) {
                    upgradeTier(1);
                } else if (secondsPassed >= 24 && relaxationTier.current <= 1) {
                    upgradeTier(2);
                } else if (secondsPassed >= 36 && relaxationTier.current <= 2) {
                    upgradeTier(3);
                } else if (secondsPassed >= 48 && relaxationTier.current <= 3) {
                    upgradeTier(4);
                } else if (secondsPassed >= 60) {
                    cancelSearch();
                    pushToast({
                        tone: "info",
                        message:
                            "No match found within 60 seconds. Try broadening your topic or language.",
                    });
                    clearInterval(relaxationTimer);
                }
            }, 1000);
        }

        return () => {
            if (relaxationTimer) clearInterval(relaxationTimer);
        };
    }, [isSearching, isConnected, topic, difficulty, language, userScore]);

    const startSearch = async () => {
        if (userScore === null) {
            pushToast({
                tone: "error",
                message: "Still loading your profile. Please try again in a moment.",
            });
            return;
        }
        setIsSearching(true);
        relaxationTier.current = 0;
        setActiveTier(0);
        searchStartTime.current = Date.now();

        await matchingService.connect();
        matchingService.joinQueue({
            topic,
            difficulties: [difficulty],
            languages: [language],
            userScore: userScore,
            scoreRange: SCORE_RANGE.DEFAULT,
        });
    };

    return { isSearching, activeTier, startSearch, cancelSearch, userScore, isConnected };
}
