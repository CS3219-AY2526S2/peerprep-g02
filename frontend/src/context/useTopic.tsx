import { useContext } from "react";

import { TopicContext, UseCaseContext } from "./TopicContext";

export function useTopics() {
    const context = useContext(TopicContext);

    if (!context) {
        throw new Error("TopicProvider not found");
    }

    return context;
}
export function useUseCase() {
    const context = useContext(UseCaseContext);

    if (!context) {
        throw new Error("UseCaseProvider not found");
    }

    return context;
}
