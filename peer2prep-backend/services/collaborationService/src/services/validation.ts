import type { CreateSessionRequest } from "@/types/session.js";

const nonEmptyString = (value: unknown): value is string =>
    typeof value === "string" && value.trim().length > 0;

export function validateCreateSessionPayload(payload: unknown): {
    valid: boolean;
    value?: CreateSessionRequest;
    error?: string;
} {
    if (!payload || typeof payload !== "object") {
        return {
            valid: false,
            error: "Request body must be a JSON object.",
        };
    }

    const candidate = payload as Record<string, unknown>;
    const { userAId, userBId, difficulty, language } = candidate;

    if (!nonEmptyString(userAId)) {
        return { valid: false, error: "userAId is required." };
    }

    if (!nonEmptyString(userBId)) {
        return { valid: false, error: "userBId is required." };
    }

    if (userAId === userBId) {
        return { valid: false, error: "userAId and userBId must be different." };
    }

    if (!nonEmptyString(difficulty)) {
        return { valid: false, error: "difficulty is required." };
    }

    if (!nonEmptyString(language)) {
        return { valid: false, error: "language is required." };
    }

    return {
        valid: true,
        value: {
            userAId,
            userBId,
            difficulty,
            language,
        },
    };
}
