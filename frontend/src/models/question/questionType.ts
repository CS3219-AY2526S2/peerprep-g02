import { UUID } from "node:crypto";

export type QuestionInfo = {
    quid: UUID;
    title: string;
    topics: UUID[];
    difficulty: string;
};

export type QuestionData = {
    quid: UUID;
    title: string;
    topics: UUID[];
    difficulty: string;
    testCase: TestCase[];
    description: string;
    qnImage: string | null;
    version: number;
};

export interface FormData {
    qnTitle: string;
    qnDesc: string;
    testCase: TestCase[];
    qnImage?: string | null;
    difficulty: Difficulty;
    qnTopics: UUID[];
    version: number;
}

export interface ErrorPopupInfo {
    showPopup: boolean;
    error: string;
}

export interface TestCase {
    input: string;
    output: string;
}

export enum Difficulty {
    EASY = "Easy",
    MEDIUM = "Medium",
    HARD = "Hard",
}

export type LeetcodeInfo = {
    quid: UUID;
    title: string;
    title_slug: string;
    topics: string[];
    difficulty: string;
};

export type Props = {
    children: React.ReactNode;
};

export type TopicMap = Record<UUID, string> | null;

export type TopicContextType = {
    topics: TopicMap;
    setTopics: React.Dispatch<React.SetStateAction<TopicMap>>;
    refreshTopics: () => Promise<void>;
    fullTopicInfo: TopicInfoDetailed[];
};

export type UseCaseContextType = {
    useCase: UUID | null;
    setUseCase: React.Dispatch<React.SetStateAction<UUID | null>>;
};

export type TopicInfo = {
    tid: UUID | null;
    topic: string;
};

export type TopicInfoDetailed = {
    tid: UUID | null;
    topic: string;
    version: number;
};

export type TopicTag = {
    name: string;
};

export type LeetcodeApiItem = {
    quid: number;
    title: string;
    titleSlug: string;
    topicTags: TopicTag[];
    difficulty: string;
};
