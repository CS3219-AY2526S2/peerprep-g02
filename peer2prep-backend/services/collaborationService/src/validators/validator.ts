/** Validates inbound REST payloads for session creation and join requests. */
import {
    CreateSessionRequest,
    SessionDifficulty,
} from "@/models/models.js";

const nonEmptyString = (value: unknown): value is string =>
    typeof value === "string" && value.trim().length > 0;

const allowedDifficulties = new Set<string>(Object.values(SessionDifficulty));

export type CreateSessionValidationResult =
    | { valid: true; value: CreateSessionRequest }
    | { valid: false; error: string };

export function validateCreateSessionPayload(
    payload: unknown,
): CreateSessionValidationResult {
    if (!payload || typeof payload !== "object") {
        return {
            valid: false,
            error: "Request body must be a JSON object.",
        };
    }

    const candidate = payload as Record<string, unknown>;
    const { matchId, userAId, userBId, difficulty, language, topic } = candidate;

    if (!nonEmptyString(matchId)) {
        return { valid: false, error: "matchId is required." };
    }

    if (!nonEmptyString(userAId)) {
        return { valid: false, error: "userAId is required." };
    }

    if (!nonEmptyString(userBId)) {
        return { valid: false, error: "userBId is required." };
    }

    if (userAId.trim() === userBId.trim()) {
        return { valid: false, error: "userAId and userBId must be different." };
    }

    if (!nonEmptyString(difficulty)) {
        return { valid: false, error: "difficulty is required." };
    }

    if (!allowedDifficulties.has(difficulty)) {
        return {
            valid: false,
            error: `difficulty must be one of: ${Object.values(SessionDifficulty).join(", ")}.`,
        };
    }

    if (!nonEmptyString(language)) {
        return { valid: false, error: "language is required." };
    }

    if (!nonEmptyString(topic)) {
        return { valid: false, error: "topic is required." };
    }

    return {
        valid: true,
        value: {
            matchId: matchId.trim(),
            userAId: userAId.trim(),
            userBId: userBId.trim(),
            difficulty: difficulty as SessionDifficulty,
            language: language.trim(),
            topic: topic.trim(),
        },
    };
}

export type JoinSessionValidationResult =
    | { valid: true; value: { sessionId: string } }
    | { valid: false; error: string };

export function validateJoinSessionRequest(
    payload: unknown,
): JoinSessionValidationResult {
    if (!payload || typeof payload !== "object") {
        return {
            valid: false,
            error: "Join request must be a JSON object.",
        };
    }

    const candidate = payload as Record<string, unknown>;
    const { sessionId } = candidate;

    if (!nonEmptyString(sessionId)) {
        return {
            valid: false,
            error: "sessionId is required.",
        };
    }

    return {
        valid: true,
        value: {
            sessionId: sessionId.trim(),
        },
    };
}
