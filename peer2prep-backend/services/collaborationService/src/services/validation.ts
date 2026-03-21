import type { CreateSessionRequest } from "@/models/session.js";

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isDifficulty(
    value: unknown,
): value is CreateSessionRequest["difficulty"] {
    return value === "Easy" || value === "Medium" || value === "Hard";
}

type ValidationResult =
    | { valid: true; value: CreateSessionRequest }
    | { valid: false; error: string };

export function validateCreateSessionPayload(payload: unknown): ValidationResult {
    if (!payload || typeof payload !== "object") {
        return { valid: false, error: "Request body must be a JSON object." };
    }

    const candidate = payload as Record<string, unknown>;
    const { matchId, userAId, userBId, difficulty, language, topic } = candidate;

    if (matchId !== undefined && !isNonEmptyString(matchId)) {
        return { valid: false, error: "matchId must be a non-empty string when provided." };
    }

    if (!isNonEmptyString(userAId)) {
        return { valid: false, error: "userAId is required." };
    }

    if (!isNonEmptyString(userBId)) {
        return { valid: false, error: "userBId is required." };
    }

    if (userAId === userBId) {
        return { valid: false, error: "userAId and userBId must be different." };
    }

    if (!isDifficulty(difficulty)) {
        return {
            valid: false,
            error: "difficulty must be one of: Easy, Medium, Hard.",
        };
    }

    if (!isNonEmptyString(language)) {
        return { valid: false, error: "language is required." };
    }

    if (!isNonEmptyString(topic)) {
        return { valid: false, error: "topic is required." };
    }

    return {
        valid: true,
        value: {
            matchId: matchId?.trim(),
            userAId: userAId.trim(),
            userBId: userBId.trim(),
            difficulty,
            language: language.trim(),
            topic: topic.trim(),
        },
    };
}
