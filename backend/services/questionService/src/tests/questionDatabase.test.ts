// tests/questions.service.test.ts
import { UUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import pool from "../database";
import * as service from "../services/questionDatabase";

// Mock pool.query
vi.mock("../database", () => ({
    default: {
        query: vi.fn(),
    },
}));

describe("Questions Service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("GetQuestions should return rows", async () => {
        const mockRows = [{ quid: "123", title: "Test" }];
        (pool.query as any).mockResolvedValue({ rows: mockRows });

        const result = await service.GetQuestions();
        expect(pool.query).toHaveBeenCalledWith("SELECT * FROM questions LIMIT 5");
        expect(result).toEqual(mockRows);
    });

    it("GetPopularQuestions should return top 3 titles", async () => {
        const mockRows = [{ title: "Q1" }, { title: "Q2" }, { title: "Q3" }];
        (pool.query as any).mockResolvedValue({ rows: mockRows });

        const result = await service.GetPopularQuestions();
        expect(pool.query).toHaveBeenCalledWith(
            "SELECT title FROM questions ORDER BY popularity_score DESC LIMIT 3",
        );
        expect(result).toEqual(mockRows);
    });

    it("CreateQuestion should return true on success", async () => {
        const data = {
            qnTitle: "Test Question",
            qnDesc: "Description",
            testCase: [{ input: "1", output: "2" }],
            difficulty: "Easy",
            qnTopics: ["uuid1"],
        };
        (pool.query as any).mockResolvedValue({ rows: [{ quid: "q1" }] });

        const result = await service.CreateQuestion(data as any);
        expect(result).toBe(true);
    });

    it("EditQuestion should return true on success", async () => {
        const data = {
            quid: "uuid1",
            qnTitle: "Updated Title",
            qnDesc: "Updated Desc",
            testCase: [{ input: "1", output: "2" }],
            difficulty: "Medium",
            qnTopics: ["uuid1"],
        };
        (pool.query as any).mockResolvedValue({ rows: [{ quid: "uuid1" }] });

        const result = await service.EditQuestion(data as any);
        expect(result).toBe(true);
    });

    it("DeleteQuestion should return true on success", async () => {
        (pool.query as any).mockResolvedValue({ rows: [] });
        const result = await service.DeleteQuestion("uuid1" as UUID);
        expect(result).toBe(true);
        expect(pool.query).toHaveBeenCalledWith("DELETE FROM questions WHERE quid = $1", ["uuid1"]);
    });

    it("GetQuestion should return rows for a given quid", async () => {
        const mockRows = [{ quid: "uuid1", title: "Test" }];
        (pool.query as any).mockResolvedValue({ rows: mockRows });

        const result = await service.GetQuestion("uuid1" as UUID);
        expect(result).toEqual(mockRows);
    });

    it("SearchQuestion should return a UUID", async () => {
        // Mock GetQuestion and pool.query
        const mockQuid = "uuid1";
        vi.spyOn(service, "GetQuestion").mockResolvedValue([{ quid: mockQuid }]);
        (pool.query as any).mockResolvedValue({
            rows: [{ quid: mockQuid }],
        });

        const result = await service.SearchQuestion("topic1", "Easy", null, null);
        expect(result.quid).toBe(mockQuid);
    });
});
