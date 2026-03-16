import { validateCreateSessionPayload } from "./validation.js";

describe("validateCreateSessionPayload", () => {
    it("accepts a complete session creation request", () => {
        const result = validateCreateSessionPayload({
            userAId: "user-a",
            userBId: "user-b",
            difficulty: "Medium",
            language: "TypeScript",
            topic: "Trees",
        });

        expect(result).toEqual({
            valid: true,
            value: {
                userAId: "user-a",
                userBId: "user-b",
                difficulty: "Medium",
                language: "TypeScript",
                topic: "Trees",
            },
        });
    });

    it("rejects requests with malformed required fields", () => {
        const result = validateCreateSessionPayload({
            userAId: "user-a",
            difficulty: "Impossible",
            language: "",
            topic: "Graphs",
        });

        expect(result.valid).toBe(false);
        expect(result).toMatchObject({
            error: expect.any(String),
        });
    });

    it("rejects requests where both users are the same", () => {
        const result = validateCreateSessionPayload({
            userAId: "user-a",
            userBId: "user-a",
            difficulty: "Easy",
            language: "Python",
            topic: "Arrays",
        });

        expect(result).toEqual({
            valid: false,
            error: "userAId and userBId must be different users.",
        });
    });
});
