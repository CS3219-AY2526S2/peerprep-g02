import { UUID } from "node:crypto";

export type QuestionInfo = {
    quid: UUID;
    title: string;
    topics: string[];
    difficulty: string;
};

export type QuestionData = {
    quid: UUID;
    title: string;
    topics: string[];
    difficulty: string;
    testCase: TestCase[];
    description: string;
};

export interface FormData {
    qnTitle: string;
    qnDesc: string;
    testCase: TestCase[];
    qnImage?: File | null;
    difficulty: Difficulty;
    qnTopics: string;
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

export const LANGUAGE_OPTIONS = [
    "Python",
    "Java",
    "C++",
    "JavaScript",
    "TypeScript",
    "Go",
    "Rust",
] as const;

export type Language = (typeof LANGUAGE_OPTIONS)[number];
