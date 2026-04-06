import { startTransition, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useUser } from "@clerk/clerk-react";

import { Card } from "@/components/ui/card";

import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import { collaborationRoute } from "@/constants/routes";
import { apiFetch } from "@/utils/apiClient";
import { getRelaxedDifficulties } from "@/utils/matching/matchingUtils";
import { Language, LANGUAGE_OPTIONS } from "@/models/matching/matchingDetailsType";
import { ActiveSession } from "@/models/matching/rejoinSessionType";
import { Difficulty } from "@/models/question/questionType";

import MatchFormView from "@/views/matching/MatchFormView";
import MatchSearchingView from "@/views/matching/MatchSearchingView";
import { RejoinSessionView } from "@/views/matching/RejoinSessionView";

import { collaborationService } from "@/services/collaboration/collaborationService";
import { useMatchingQueue } from "@/services/matching/useMatchingQueue";

export function MatchingView() {
    const navigate = useNavigate();
    const { isLoaded, user } = useUser();

    const [topicOptions, setTopicOptions] = useState<string[]>([]);
    const [topics, setTopics] = useState<string[]>([]);
    const [languages, setLanguages] = useState<Language[]>(() => {
        if (!isLoaded || !user) return [LANGUAGE_OPTIONS[0]];

        const metadata = (user.unsafeMetadata || {}) as Record<string, unknown>;
        const defaultLang = metadata.defaultLanguage as Language;

        if (defaultLang && (LANGUAGE_OPTIONS as readonly string[]).includes(defaultLang)) {
            return [defaultLang];
        }

        return [LANGUAGE_OPTIONS[0]];
    });
    const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.EASY);

    const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
    const [checkingSession, setCheckingSession] = useState(true);

    useEffect(() => {
        if (!isLoaded || !user) return;

        let isMounted = true;
        collaborationService
            .checkActiveSession()
            .then((session) => {
                if (isMounted) {
                    setActiveSession(session);
                    setCheckingSession(false);
                }
            })
            .catch(() => {
                if (isMounted) setCheckingSession(false);
            });

        return () => {
            isMounted = false;
        };
    }, [isLoaded, user]);

    useEffect(() => {
        const fetchTopics = async () => {
            try {
                const response = await apiFetch(API_ENDPOINTS.QUESTIONS.TOPICS);
                if (!response.ok) return;

                const data = await response.json();
                const topicStrings: string[] = data.body.map(
                    (item: { topic: string }) => item.topic,
                );

                setTopicOptions(topicStrings);
                if (topicStrings.length > 0) {
                    setTopics([topicStrings[0]]);
                }
            } catch (err) {
                console.error("Failed to fetch topics", err);
            }
        };
        fetchTopics();
    }, []);

    const handleNavigation = (id: string) => {
        startTransition(() => {
            navigate(collaborationRoute(id));
        });
    };

    const {
        isSearching,
        isPreparing,
        activeTier,
        startSearch,
        cancelSearch,
        userScore,
        isConnected,
    } = useMatchingQueue(topics, languages, difficulty, (payload) => {
        if (payload.collaborationId) {
            handleNavigation(payload.collaborationId);
        }
    });

    return (
        <div className="space-y-4">
            {!checkingSession && activeSession && !isSearching && (
                <RejoinSessionView session={activeSession} onRejoin={handleNavigation} />
            )}

            <Card className="relative overflow-hidden rounded-[30px] border border-white/70 backdrop-blur transition-all duration-500 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                {isSearching || isPreparing ? (
                    <MatchSearchingView
                        isPreparing={isPreparing}
                        topics={topics}
                        languages={languages}
                        difficulties={getRelaxedDifficulties(difficulty, activeTier)}
                        relaxationTier={activeTier}
                        onCancel={cancelSearch}
                        isConnected={isConnected}
                    />
                ) : (
                    <MatchFormView
                        topicOptions={topicOptions}
                        languageOptions={LANGUAGE_OPTIONS}
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
        </div>
    );
}
