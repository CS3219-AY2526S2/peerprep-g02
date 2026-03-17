import { describe, expect, it } from "@jest/globals";

import { SessionDifficulty } from "@/models/models.js";
import { validateCreateSessionPayload } from "@/validators/validator.js";

describe("validateCreateSessionPayload", () => {
    it("accepts a well-formed session creation payload", () => {
        const result = validateCreateSessionPayload({
            userAId: " user-a ",
            userBId: "user-b",
            difficulty: SessionDifficulty.HARD,
            language: " TypeScript ",
            topic: " Graphs ",
        });

        expect(result).toEqual({
            valid: true,
            value: {
                userAId: "user-a",
                userBId: "user-b",
                difficulty: SessionDifficulty.HARD,
                language: "TypeScript",
                topic: "Graphs",
            },
        });
    });

    it("rejects malformed payloads", () => {
        const result = validateCreateSessionPayload({
            userAId: "user-a",
            userBId: "user-a",
            difficulty: "Impossible",
            language: "",
            topic: "Graphs",
        });

        expect(result.valid).toBe(false);
    });
});
