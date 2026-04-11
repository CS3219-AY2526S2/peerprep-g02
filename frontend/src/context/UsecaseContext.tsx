import { useState } from "react";

import { UUID } from "crypto";

import { Props } from "@/models/question/questionType";

import { UseCaseContext } from "./TopicContext";

export function UseCaseProvider({ children }: Props) {
    const [useCase, setUseCase] = useState<UUID | null>(null);

    return (
        <UseCaseContext.Provider value={{ useCase, setUseCase }}>
            {children}
        </UseCaseContext.Provider>
    );
}
