import { startTransition, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useUser } from "@clerk/clerk-react";

import { Card } from "@/components/ui/card";

import { collaborationRoute } from "@/constants/routes";
import { getRelaxedDifficulties } from "@/utils/matching/matchingUtils";
import { Language, LANGUAGE_OPTIONS } from "@/models/matching/matchingDetailsType";
import { ActiveSession } from "@/models/matching/rejoinSessionType";
import { Difficulty } from "@/models/question/questionType";

import MatchFormView from "@/views/matching/MatchFormView";
import MatchSearchingView from "@/views/matching/MatchSearchingView";
import { RejoinSessionView } from "@/views/matching/RejoinSessionView";

import { useTopics } from "@/context/useTopic";
import { collaborationService } from "@/services/collaboration/collaborationService";
import { useMatchingQueue } from "@/services/matching/useMatchingQueue";

export function MatchingView() {
    const navigate = useNavigate();
    const { isLoaded, user } = useUser();

    const { topics: topicMap } = useTopics();

    const topicOptions = useMemo(() => {
        return topicMap ? Object.values(topicMap) : [];
    }, [topicMap]);

    const [selectedTopicNames, setSelectedTopicNames] = useState<string[]>([]);
    
    const topicsForQueue = useMemo(() => {
        if (!topicMap) return [];

        const allEntries = Object.entries(topicMap).map(([id, name]) => ({
            id,
            name,
        }));

        if (selectedTopicNames.length > 0) {
            return selectedTopicNames
                .map((name) => allEntries.find((t) => t.name === name))
                .filter((t): t is { id: string; name: string } => t !== undefined);
        }

        return allEntries.length > 0 ? [allEntries[0]] : [];
    }, [selectedTopicNames, topicMap]);

    const [languages, setLanguages] = useState<Language[]>([LANGUAGE_OPTIONS[0]]);
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
        if (!isLoaded || !user) return;

        const metadata = (user.unsafeMetadata || {}) as Record<string, unknown>;
        const defaultLang = metadata.defaultLanguage as Language;

        if (defaultLang && (LANGUAGE_OPTIONS as readonly string[]).includes(defaultLang)) {
            setLanguages((prev) =>
                prev.length === 1 && prev[0] === defaultLang ? prev : [defaultLang],
            );
        }
    }, [isLoaded, user]);

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
    } = useMatchingQueue(topicsForQueue, languages, difficulty, (payload) => {
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
                        topics={selectedTopicNames} 
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
                        topics={selectedTopicNames}
                        setTopics={setSelectedTopicNames}
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