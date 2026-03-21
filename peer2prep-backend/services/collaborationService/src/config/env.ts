import { DEFAULTS } from "@/config/constants.js";

function readNumber(value: string | undefined, fallback: number): number {
    if (!value) {
        return fallback;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
    if (!value) {
        return fallback;
    }

    return value.toLowerCase() === "true";
}

function trimTrailingSlash(value: string | undefined): string | undefined {
    return value?.replace(/\/+$/, "");
}

export const env = {
    port: readNumber(process.env.CS_SERVER_PORT, DEFAULTS.SERVER_PORT),
    frontendUrl: process.env.CS_FRONTEND_URL ?? "http://localhost:5173",
    logLevel: process.env.CS_LOG_LEVEL ?? "info",
    sessionTtlMs: readNumber(process.env.CS_SESSION_TTL_MS, DEFAULTS.SESSION_TTL_MS),
    dependencyTimeoutMs: readNumber(
        process.env.CS_DEPENDENCY_TIMEOUT_MS,
        DEFAULTS.DEPENDENCY_TIMEOUT_MS,
    ),
    apiGatewayUrl: trimTrailingSlash(process.env.CS_API_GATEWAY_URL) ?? "http://localhost:8080",
    internalServiceApiKey: process.env.CS_INTERNAL_SERVICE_API_KEY ?? "",
    userAuthContextPath:
        process.env.CS_USER_AUTH_CONTEXT_PATH ?? "/v1/api/users/internal/authz/context",
    userAuthBatchPath:
        process.env.CS_USER_AUTH_BATCH_PATH ?? "/v1/api/users/internal/validation/batch",
    questionSelectionPath:
        process.env.CS_QUESTION_SELECTION_PATH ?? "/v1/api/questions/internal/select",
    useQuestionStub: readBoolean(process.env.CS_USE_QUESTION_STUB, false),
    stubQuestionPrefix:
        process.env.CS_STUB_QUESTION_PREFIX ?? DEFAULTS.STUB_QUESTION_PREFIX,
    redisHost: process.env.CS_REDIS_HOST ?? "127.0.0.1",
    redisPort: readNumber(process.env.CS_REDIS_PORT, DEFAULTS.REDIS_PORT),
    redisDb: readNumber(process.env.CS_REDIS_DB, DEFAULTS.REDIS_DB),
    redisKeyPrefix: process.env.CS_REDIS_KEY_PREFIX ?? "collaboration-service:",
};
