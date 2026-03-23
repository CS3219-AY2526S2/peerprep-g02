import { UUID } from "node:crypto";

import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import { apiFetch } from "@/utils/apiClient";
import { QuestionData, QuestionInfo, TestCase } from "@/models/question/questionType";

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
    } catch (e) {
        console.error(e);
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
    } catch (e) {
        console.error(e);
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

        const cases: TestCase[] = data.test_case.map((item: TestCase) => ({
            // Matching your .slice(1, -1) logic to strip quotes from stringified JSON
            input: JSON.stringify(item.input).slice(1, -1),
            output: JSON.stringify(item.output).slice(1, -1),
        }));

        return {
            quid: data.quid,
            title: data.title,
            topics: data.topics,
            difficulty: data.difficulty,
            testCase: cases,
            description: data.description,
        };
    } catch (e) {
        console.error(e);
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
    const res = await apiFetch(API_ENDPOINTS.QUESTIONS.DELETE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quid: id }),
    });
    return res.status;
};
