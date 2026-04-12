// tests/topics.service.test.ts
import { UUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import pool from "../database";
import * as service from "../services/topicDatabase";

type TopicInfo = {
    tid: UUID;
    topic: string;
};

vi.mock("../database", () => ({
    default: {
        query: vi.fn(),
    },
}));

describe("Topics Service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("GetTopics should return rows", async () => {
        const mockRows = [{ tid: "uuid1", topic: "Math" }];
        (pool.query as any).mockResolvedValue({ rows: mockRows });

        const result = await service.GetTopics();
        expect(pool.query).toHaveBeenCalledWith("SELECT * FROM topics");
        expect(result).toEqual(mockRows);
    });

    it("AddTopic should return true on success", async () => {
        const data: TopicInfo[] = [
            { tid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0542", topic: "Science" },
            { tid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0543", topic: "Math" },
        ];
        (pool.query as any).mockResolvedValue({
            rows: [
                { tid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0542" },
                { tid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0543" },
            ],
        });

        const result = await service.AddTopic(data);
        expect(result).toBe(true);
        // Check that the query string contains all topic values
        const calledQuery = (pool.query as any).mock.calls[0][0];
        expect(calledQuery).toContain("Science");
        expect(calledQuery).toContain("Math");
    });

    it("EditTopic should return true on success", async () => {
        const data: TopicInfo[] = [
            { tid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0542", topic: "Physics" },
            { tid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0543", topic: "Biology" },
        ];
        (pool.query as any).mockResolvedValue({
            rows: [
                { tid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0542" },
                { tid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0543" },
            ],
        });

        const result = await service.EditTopic(data);
        expect(result).toBe(true);
        expect(pool.query).toHaveBeenCalledTimes(2);
        expect(pool.query).toHaveBeenCalledWith(
            "UPDATE topics SET topic = $2 WHERE tid = $1 RETURNING tid",
            ["5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0542", "Physics"],
        );
        expect(pool.query).toHaveBeenCalledWith(
            "UPDATE topics SET topic = $2 WHERE tid = $1 RETURNING tid",
            ["5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0543", "Biology"],
        );
    });

    it("DeleteTopic should delete related questions and return true", async () => {
        const tid = "uuid1";
        (pool.query as any)
            .mockResolvedValueOnce({ rows: [{ quid: "q1" }, { quid: "q2" }] }) // select all quid
            .mockResolvedValue({ rows: [] }); // deletes

        const result = await service.DeleteTopic(tid as UUID);
        expect(result).toBe(true);
        // Check select query
        expect(pool.query).toHaveBeenCalledWith("SELECT quid FROM qn_topics WHERE tid = $1", [tid]);
        // Check deletes for questions
        expect(pool.query).toHaveBeenCalledWith("DELETE FROM questions WHERE quid = $1", ["q1"]);
        expect(pool.query).toHaveBeenCalledWith("DELETE FROM questions WHERE quid = $1", ["q2"]);
        // Check delete for topic
        expect(pool.query).toHaveBeenCalledWith("DELETE FROM topics WHERE tid = $1", [tid]);
    });

    it("DeleteTopic should return false if query fails", async () => {
        const tid = "uuid1";
        (pool.query as any).mockRejectedValue(new Error("DB error"));
        const result = await service.DeleteTopic(tid as UUID);
        expect(result).toBe(false);
    });
});
