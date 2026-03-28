import { LeetcodeInfo, QuestionData, QuestionInfo, TestCase } from "@/models/question/questionType";
import { apiFetch } from "@/utils/apiClient";
import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import { UUID } from "node:crypto";

export const getQuestions = async (): Promise<QuestionInfo[] | null> => {
    try {
        const res = await apiFetch(API_ENDPOINTS.QUESTIONS.BASE, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
        });

        const data = await res.json();
        if (!data || !data.body) return null;

        const questions: QuestionInfo[] = data.body.map((item: any) => ({
            quid: item.quid,
            title: item.title,
            topics: item.topics,
            difficulty: item.difficulty,
        }));
        return questions;
    } catch (e: any) {
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

        return data.body.map((item: any) => item.title);
    } catch (e: any) {
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

        const cases: TestCase[] = data.test_case.map((item: any) => ({
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
    } catch (e: any) {
        console.error(e);
        return null;
    }
};

export const SearchQuestionDatabase = async (title: String): Promise<QuestionInfo[] | null> => {
    try {
        if (title.trim().length == 0) return null;
        console.log(title);
        const res = await apiFetch(API_ENDPOINTS.QUESTIONS.SEARCH_DATABASE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: title.trim() }),
        });

        const result = await res.json();
        console.log(result);
        const data = result?.body;

        if (!data) return null;
        console.log(data);
        const questions: QuestionInfo[] = data.map((item: any) => ({
            quid: item.quid,
            title: item.title,
            topics: item.topics,
            difficulty: item.difficulty,
        }));

        return questions;
    } catch (e: any) {
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
    const res = await apiFetch(API_ENDPOINTS.QUESTIONS.BASE + "/" + id, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
        },
    });
    return res.status;
}

// export const getLeetcodeQuestions = async (): Promise<LeetcodeInfo[] | null> => {
//     try {
//         const res = await apiFetch(API_ENDPOINTS.QUESTIONS.LEETCODE, {
//             method: "POST",
//             headers: {
//                 "Content-Type": "application/json",
//                 "cache-control": "no-cache"
//             },
//             body: JSON.stringify({ topic: "String" }),
//         });
//         const data = await res.json();
//         const questions: LeetcodeInfo[] = data.body.map((item: any) => ({
//             quid: item.quid,
//             title: item.title,
//             title_slug: item.titleSlug,
//             topics: item.topicTags.map((topic: any) => topic.name),
//             difficulty: item.difficulty,
//         }));
//         return questions;

//     } catch (e: any) {
//         console.log(e);
//         return null;
//     }

// }

export const getLeetcodeQuestions = async (): Promise<LeetcodeInfo[] | null> => {
    try {
        const res = await apiFetch(API_ENDPOINTS.QUESTIONS.LEETCODE, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "cache-control": "no-cache"
            },
        });
        const data = await res.json();
        const questions: LeetcodeInfo[] = data.body.map((item: any) => ({
            quid: item.quid,
            title: item.title,
            title_slug: item.titleSlug,
            topics: item.topicTags.map((topic: any) => topic.name),
            difficulty: item.difficulty,
        }));
        return questions;

    } catch (e: any) {
        console.log(e);
        return null;
    }

}