import { startTransition, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useUser } from "@clerk/clerk-react";
import { ArrowRight, Radio } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import { collaborationRoute } from "@/constants/routes";
import { apiFetch } from "@/utils/apiClient";
import { getRelaxedDifficulties } from "@/utils/matching/matchingUtils";
import { Language, LANGUAGE_OPTIONS } from "@/models/matching/matchingDetailsType";
import { Difficulty } from "@/models/question/questionType";

import MatchFormView from "@/views/matching/MatchFormView";
import MatchSearchingView from "@/views/matching/MatchSearchingView";

import { collaborationService } from "@/services/collaboration/collaborationService";
import { useMatchingQueue } from "@/services/matching/useMatchingQueue";

type ActiveSession = {
    collaborationId: string;
    topic: string;
    difficulty: string;
};

export function MatchingView() {
    const navigate = useNavigate();

    const { isLoaded, user } = useUser();

    const [topicOptions, setTopicOptions] = useState<string[]>([]);

    const [topics, setTopics] = useState<string[]>([]);
    const [languages, setLanguages] = useState<Language[]>([LANGUAGE_OPTIONS[0]]);
    const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.EASY);

    const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
    const [checkingSession, setCheckingSession] = useState(true);

    // Check for active collaboration session on mount
    useEffect(() => {
        if (!isLoaded || !user) return;

        let cancelled = false;
        collaborationService
            .checkActiveSession()
            .then((session) => {
                if (!cancelled) {
                    setActiveSession(session);
                    setCheckingSession(false);
                }
            })
            .catch(() => {
                if (!cancelled) setCheckingSession(false);
            });

        return () => {
            cancelled = true;
        };
    }, [isLoaded, user]);

    useEffect(() => {
        if (isLoaded && user) {
            const metadata = (user.unsafeMetadata || {}) as Record<string, unknown>;
            const defaultLang = metadata.defaultLanguage as Language;

            if (defaultLang && (LANGUAGE_OPTIONS as readonly string[]).includes(defaultLang)) {
                setLanguages([defaultLang]);
            }
        }
    }, [isLoaded, user]);

    useEffect(() => {
        const fetchTopics = async () => {
            try {
                const response = await apiFetch(API_ENDPOINTS.QUESTIONS.TOPICS);
                if (!response.ok) {
                    throw new Error(`Failed to fetch topics: ${response.statusText}`);
                }

                const data = await response.json();
                const topicStrings: string[] = data.body.map(
                    (item: { topic: string }) => item.topic,
                );

                setTopicOptions(topicStrings);

                if (topicStrings.length > 0 && topics.length === 0) {
                    setTopics([topicStrings[0]]);
                }
            } catch (error) {
                console.error("Error fetching topics:", error);
            }
        };

        fetchTopics();
    }, []);

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
        <div className="space-y-4">
            {/* Active session rejoin banner */}
            {!checkingSession && activeSession && !isSearching && (
                <Card className="overflow-hidden rounded-[24px] border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-violet-50 shadow-lg">
                    <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-8">
                        <div className="flex items-center gap-4">
                            <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
                                <Radio className="size-6" />
                            </div>
                            <div>
                                <p className="text-lg font-bold text-slate-900">
                                    You have an active session
                                </p>
                                <div className="mt-1 flex items-center gap-2">
                                    <Badge
                                        variant="outline"
                                        className="rounded-full border-indigo-200 bg-indigo-50 text-indigo-700"
                                    >
                                        {activeSession.topic}
                                    </Badge>
                                    <Badge
                                        variant="outline"
                                        className="rounded-full border-indigo-200 bg-indigo-50 text-indigo-700"
                                    >
                                        {activeSession.difficulty}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                        <Button
                            className="h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 text-base font-semibold text-white shadow-md hover:from-indigo-500 hover:to-violet-500"
                            onClick={() => {
                                startTransition(() => {
                                    navigate(collaborationRoute(activeSession.collaborationId));
                                });
                            }}
                        >
                            Rejoin Session
                            <ArrowRight className="ml-2 size-4" />
                        </Button>
                    </div>
                </Card>
            )}

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
