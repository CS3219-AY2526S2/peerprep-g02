// AI Assistance Disclosure:
// Tool: ChatGPT (model: GPT‑4 Turbo), date: 2026‑04-16
// Scope: Generated scaffolding for setting up test cases, and mocking database and client
// Author review: I added test cases to ensure key queries were executed
import { UUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import pool from "../database";
import {
    CreateQuestion,
    DeleteQuestion,
    EditQuestion,
    GetQuestions,
} from "../services/questionDatabase";
import { deleteImage } from "../services/questionImage";

type TestCase = {
    input: string;
    output: string;
};

type QuestionData = {
    qnTitle: string;
    qnDesc: string;
    testCase: TestCase[];
    difficulty: string;
    qnTopics: UUID[];
    qnImage?: string | null;
};

type QuestionEdit = {
    quid: UUID;
    qnTitle: string;
    qnDesc: string;
    testCase: TestCase[];
    difficulty: string;
    qnTopics: UUID[];
    qnImage?: string | null;
    version: number;
};

vi.mock("../database", () => ({
    default: {
        connect: vi.fn(),
        query: vi.fn(),
    },
}));

vi.mock("../services/questionImage", () => ({
    deleteImage: vi.fn().mockResolvedValue(true),
}));

describe("Questions Service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("GetQuestions should return rows", async () => {
        const mockRows = [{ quid: "123", title: "Test" }];
        (pool.query as any).mockResolvedValue({ rows: mockRows });

        const result = await GetQuestions();
        expect(pool.query).toHaveBeenCalledWith(
            "SELECT * FROM questions ORDER BY updated_at DESC LIMIT 5",
        );
        expect(result).toEqual(mockRows);
    });

    it("should insert question and associated topics", async () => {
        const mockData: QuestionData = {
            qnTitle: "Test Question",
            qnDesc: "Description",
            testCase: [{ input: "a", output: "b" }],
            difficulty: "easy",
            qnTopics: [
                "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0544",
                "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0545",
            ],
            qnImage: "/upload/test-image-url",
        };

        const mockClient = {
            query: vi.fn().mockResolvedValue([]),
            release: vi.fn(),
        };

        pool.connect.mockResolvedValue(mockClient);

        mockClient.query.mockResolvedValueOnce({
            rows: [{ quid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0543" }],
        });
        mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

        await CreateQuestion(mockData);

        expect(mockClient.query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO questions"),
            expect.arrayContaining([
                mockData.qnTitle,
                mockData.qnDesc,
                mockData.difficulty,
                mockData.qnImage,
            ]),
        );
        expect(mockClient.release).toHaveBeenCalled();
    });

    it("EditQuestion should update existing question and topics", async () => {
        const mockData: QuestionEdit = {
            quid: "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0543",
            qnTitle: "Test Question",
            qnDesc: "Description",
            testCase: [{ input: "a", output: "b" }],
            difficulty: "easy",
            qnTopics: [
                "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0544",
                "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0545",
            ],
            qnImage: "/upload/test-image-url",
            version: 1,
        };

        const mockClient = {
            query: vi.fn(),
            release: vi.fn(),
        };

        pool.connect.mockResolvedValue(mockClient);

        mockClient.query.mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ version: 1, image: "/old-image-url" }],
        });

        await EditQuestion(mockData);

        expect(mockClient.query).toHaveBeenCalledWith(
            expect.stringContaining("SELECT version, image FROM questions WHERE quid = $1"),
            [mockData.quid],
        );

        expect(mockClient.release).toHaveBeenCalled();
    });

    it("DeleteQuestion should delete a question and its image", async () => {
        const questionId = "5752a2a8-d4a6-4cc9-8fcf-bb4dfe3a0544";
        const mockQuestion = { quid: questionId, image: "image-url" };

        (pool.query as any).mockResolvedValueOnce({ rows: [mockQuestion] });
        (pool.query as any).mockResolvedValueOnce({ rowCount: 1 });

        const result = await DeleteQuestion(questionId);

        expect(pool.query).toHaveBeenCalledWith("DELETE FROM questions WHERE quid = $1", [
            questionId,
        ]);
        expect(deleteImage).toHaveBeenCalledWith("image-url");
        expect(result).toBe(1);
    });
});
