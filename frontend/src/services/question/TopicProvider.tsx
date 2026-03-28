import {
    Props,
    TopicContextType,
    TopicMap,
    UseCaseContextType,
} from "@/models/question/questionType";
import { UUID } from "crypto";
import { createContext, useContext, useState } from "react";

export const TopicContext = createContext<TopicContextType | undefined>(undefined);

export function TopicProvider({ children }: Props) {
    const [topics, setTopics] = useState<TopicMap>({});

    return <TopicContext.Provider value={{ topics, setTopics }}>{children}</TopicContext.Provider>;
}

export function useTopics() {
    const context = useContext(TopicContext);

    if (!context) {
        throw new Error("TopicProvider not found");
    }

    return context;
}

export const UseCaseContext = createContext<UseCaseContextType | undefined>(undefined);

export function UseCaseProvider({ children }: Props) {
    const [useCase, setUseCase] = useState<UUID | null>(null);

    return (
        <UseCaseContext.Provider value={{ useCase, setUseCase }}>
            {children}
        </UseCaseContext.Provider>
    );
}

export function useUseCase() {
    const context = useContext(UseCaseContext);

    if (!context) {
        throw new Error("UseCaseProvider not found");
    }

    return context;
}
