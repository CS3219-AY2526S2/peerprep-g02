import { UUID } from "crypto";

import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import { apiFetch } from "@/utils/apiClient";
import { TopicInfo, TopicInfoDetailed, TopicMap } from "@/models/question/questionType";

export const getTopics = async (): Promise<{
    topicMap: TopicMap | null;
    fullInfo: TopicInfoDetailed[];
} | null> => {
    try {
        const res = await apiFetch(API_ENDPOINTS.QUESTIONS.TOPICS, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
        });

        const data = await res.json();
        if (!data || !data.body) return null;
        const topics: TopicMap = data.body.reduce((mapping: TopicMap, item: TopicInfo) => {
            if (mapping == null) mapping = {};
            if (item.tid !== null) mapping[item.tid] = item.topic;
            return mapping;
        }, {});
        return { topicMap: topics, fullInfo: data.body };
    } catch {
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

export const editTopic = async (data: TopicInfoDetailed[]): Promise<number> => {
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
};
