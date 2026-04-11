import { createContext } from "react";

import { TopicContextType, UseCaseContextType } from "@/models/question/questionType";

export const TopicContext = createContext<TopicContextType | undefined>(undefined);
export const UseCaseContext = createContext<UseCaseContextType | undefined>(undefined);
