import { UUID } from "node:crypto";

import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import { apiFetch } from "@/utils/apiClient";
import {
    LeetcodeApiItem,
    LeetcodeInfo,
    QuestionData,
    QuestionInfo,
    TestCase,
} from "@/models/question/questionType";

export const getQuestions = async (): Promise<QuestionInfo[] | null> => {
    try {
        const res = await apiFetch(API_ENDPOINTS.QUESTIONS.BASE, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
        });

        const data = await res.json();
        if (!data || !data.body) return null;

        const questions: QuestionInfo[] = data.body.map((item: QuestionInfo) => ({
            quid: item.quid,
            title: item.title,
            topics: item.topics,
            difficulty: item.difficulty,
        }));
        return questions;
    } catch {
        return null;
    }
};

export const getPopularQuestions = async (): Promise<string[] | null> => {
    try {
        const res = await apiFetch(API_ENDPOINTS.QUESTIONS.POPULAR, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
        });

        const data = await res.json();
        if (!data || !data.body) return null;

        return data.body.map((item: QuestionInfo) => item.title);
    } catch {
        return null;
    }
};

export const getQuestion = async (id: UUID | null): Promise<QuestionData | null> => {
    try {
        if (!id) return null;

        const res = await apiFetch(API_ENDPOINTS.QUESTIONS.GET_ONE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quid: id }),
        });

        const result = await res.json();
        const data = result?.body?.[0];

        if (!data) return null;

        const cases: TestCase[] = data.test_case.map(
            (item: { input: unknown; output: unknown }) => ({
                input: JSON.stringify(item.input).slice(1, -1),
                output: JSON.stringify(item.output).slice(1, -1),
            }),
        );

        return {
            quid: data.quid,
            title: data.title,
            topics: data.topics,
            difficulty: data.difficulty,
            testCase: cases,
            description: data.description,
            qnImage: data.qnImage,
        };
    } catch {
        return null;
    }
};

export const SearchQuestionDatabase = async (title: string): Promise<QuestionInfo[] | null> => {
    try {
        if (title.trim().length == 0) return null;

        const res = await apiFetch(API_ENDPOINTS.QUESTIONS.SEARCH_DATABASE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: title.trim() }),
        });

        const result = await res.json();

        const data = result?.body;

        if (!data) return null;

        const questions: QuestionInfo[] = data.map((item: QuestionInfo) => ({
            quid: item.quid,
            title: item.title,
            topics: item.topics,
            difficulty: item.difficulty,
        }));

        return questions;
    } catch {
        return null;
    }
};

export const createQuestion = async (data: string): Promise<number> => {
    const res = await apiFetch(API_ENDPOINTS.QUESTIONS.BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: data,
    });
    return res.status;
};

export const editQuestion = async (data: string): Promise<number> => {
    const res = await apiFetch(API_ENDPOINTS.QUESTIONS.BASE, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: data,
    });
    return res.status;
};

export const deleteQuestion = async (id: UUID): Promise<number> => {
    const res = await apiFetch(API_ENDPOINTS.QUESTIONS.BASE + "/" + id, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
        },
    });
    return res.status;
};

export const getLeetcodeQuestionsManual = async (): Promise<LeetcodeInfo[] | null> => {
    try {
        const res = await apiFetch(API_ENDPOINTS.QUESTIONS.LEETCODE, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "cache-control": "no-cache",
            },
            body: JSON.stringify({ topic: "String" }),
        });
        const data = await res.json();
        const questions: LeetcodeInfo[] = data.body.map((item: LeetcodeApiItem) => ({
            quid: item.quid,
            title: item.title,
            title_slug: item.titleSlug,
            topics: item.topicTags.map((topic) => topic.name),
            difficulty: item.difficulty,
        }));
        return questions;
    } catch {
        return null;
    }
};

export const getLeetcodeQuestions = async (): Promise<LeetcodeInfo[] | null> => {
    try {
        const res = await apiFetch(API_ENDPOINTS.QUESTIONS.LEETCODE, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "cache-control": "no-cache",
            },
        });
        const data = await res.json();
        const questions: LeetcodeInfo[] = data.body.map((item: LeetcodeApiItem) => ({
            quid: item.quid,
            title: item.title,
            title_slug: item.titleSlug,
            topics: item.topicTags.map((topic) => topic.name),
            difficulty: item.difficulty,
        }));
        return questions;
    } catch {
        return null;
    }
};

export const imageUpload = async (file: File | null) => {
    if (!file) return;

    const res = await apiFetch(API_ENDPOINTS.QUESTIONS.IMAGE, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
        }),
    });

    const { uploadUrl, filePath } = await res.json();

    await fetch(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": file.type,
        },
        body: file,
    });
    return filePath;
};
