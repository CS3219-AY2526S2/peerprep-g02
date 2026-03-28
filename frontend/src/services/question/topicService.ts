import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import { TopicInfo, TopicMap } from "@/models/question/questionType";
import { apiFetch } from "@/utils/apiClient";
import { UUID } from "crypto";

export const getTopics = async (): Promise<TopicMap | null> => {
    try {
        const res = await apiFetch(API_ENDPOINTS.QUESTIONS.TOPICS, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
        });

        const data = await res.json();
        if (!data || !data.body) return null;
        console.log(data.body);
        const topics: TopicMap = data.body.reduce((mapping: TopicMap, item: any) => {
            if (mapping == null) mapping = {};
            mapping[item.tid] = item.topic;
            return mapping;
        }, {});
        return topics;
    } catch (e: any) {
        console.error(e);
        return null;
    }
};

export const createTopic = async (data: TopicInfo[]): Promise<number> => {
    const res = await apiFetch(API_ENDPOINTS.QUESTIONS.TOPICS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return res.status;
};

export const editTopic = async (data: TopicInfo[]): Promise<number> => {
    const res = await apiFetch(API_ENDPOINTS.QUESTIONS.TOPICS, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return res.status;
};

export const deleteTopic = async (id: UUID): Promise<number> => {
    const res = await apiFetch(API_ENDPOINTS.QUESTIONS.TOPICS + "/" + id, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
        },
    });
    return res.status;
}