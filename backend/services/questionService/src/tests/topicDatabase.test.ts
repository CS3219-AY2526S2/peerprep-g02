import { UUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import pool from "../database";
import { AddTopic, DeleteTopic, EditTopic, GetTopics } from "../services/topicDatabase";

type TopicInfo = {
    tid: UUID;
    topic: string;
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

    // Test for GetTopics
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
            { tid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0544", topic: "Array" },
            { tid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0545", topic: "String" },
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
            { tid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0544", topic: "Array" },
        ];
        const mockResult = [{ rowCount: 1 }];

        pool.query.mockResolvedValueOnce(mockResult);

        await EditTopic(mockData);

        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE topics SET topic = $2 WHERE tid = $1"),
            expect.arrayContaining([mockData[0].tid, mockData[0].topic]),
        );
    });

    it("should delete topic and related questions successfully", async () => {
        const mockTid = "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0544";
        const mockQuids = [{ quid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0545" }];
        const mockDeleteResult = { rowCount: 1 };

        pool.query
            .mockResolvedValueOnce({ rows: mockQuids })
            .mockResolvedValueOnce(mockDeleteResult)
            .mockResolvedValueOnce(mockDeleteResult);

        const result = await DeleteTopic(mockTid);

        expect(pool.query).toHaveBeenCalledWith("SELECT quid FROM qn_topics WHERE tid = $1", [
            mockTid,
        ]);
        expect(pool.query).toHaveBeenCalledWith("DELETE FROM questions WHERE quid = $1", [
            mockQuids[0].quid,
        ]);
        expect(pool.query).toHaveBeenCalledWith("DELETE FROM topics WHERE tid = $1", [mockTid]);
        expect(result).toBe(mockDeleteResult.rowCount);
    });
});
