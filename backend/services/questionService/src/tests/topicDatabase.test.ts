// AI Assistance Disclosure:
// Tool: ChatGPT (model: GPT‑4 Turbo), date: 2026‑04-16
// Scope: Generated scaffolding for setting up test cases, and mocking database
// Author review: I added test cases to ensure key queries were executed
import { UUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import pool from "../database";
import { AddTopic, EditTopic, GetTopics } from "../services/topicDatabase";

type TopicInfo = {
    tid: UUID;
    topic: string;
    version: number;
};

vi.mock("../database", () => ({
    default: {
        query: vi.fn(),
    },
}));

describe("Topic Service Functions", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("should fetch topics successfully", async () => {
        const mockResult = {
            rows: [
                { tid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0544", topic: "Array" },
                { tid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0545", topic: "String" },
            ],
        };

        pool.query.mockResolvedValue(mockResult);

        const result = await GetTopics();

        expect(pool.query).toHaveBeenCalledWith("SELECT * FROM topics");
        expect(result).toEqual(mockResult.rows);
    });

    it("should add topics successfully", async () => {
        const mockData: TopicInfo[] = [
            { tid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0544", topic: "Array", version: 1 },
            { tid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0545", topic: "String", version: 1 },
        ];
        const mockResult = { rowCount: 2 };

        pool.query.mockResolvedValueOnce(mockResult);

        const result = await AddTopic(mockData);

        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO topics(topic) VALUES"),
            expect.arrayContaining([mockData[0].topic, mockData[1].topic]),
        );
        expect(result).toBe(mockResult.rowCount);
    });

    it("should edit topics successfully", async () => {
        const mockData: TopicInfo[] = [
            { tid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0544", topic: "Array", version: 1 },
        ];
        const mockResult = [{ rowCount: 1 }];

        pool.query.mockResolvedValueOnce(mockResult);

        await EditTopic(mockData);

        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE topics SET topic = $2 WHERE tid = $1"),
            expect.arrayContaining([mockData[0].tid, mockData[0].topic]),
        );
    });
});
