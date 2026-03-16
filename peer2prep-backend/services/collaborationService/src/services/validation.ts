import type { CreateSessionRequest } from "@/models/model.js";

const nonEmptyString = (value: unknown): value is string =>
    typeof value === "string" && value.trim().length > 0;
type CreateSessionValidationResult =
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
    const { matchId } = candidate;

    if (!nonEmptyString(matchId)) {
        return { valid: false, error: "matchId is required." };
    }

    return {
        valid: true,
        value: {
            matchId,
        },
    };
}
