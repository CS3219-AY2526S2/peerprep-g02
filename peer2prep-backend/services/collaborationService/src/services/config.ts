const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

export const collaborationConfig = {
    port: Number(process.env.CS_SERVER_PORT ?? "3003"),
    frontendUrl: process.env.CS_FRONTEND_URL ?? "http://localhost:5173",
    sessionTtlMs: Number(process.env.CS_SESSION_TTL_MS ?? `${60 * 60 * 1000}`),
    redisHost: process.env.CS_REDIS_HOST ?? "127.0.0.1",
    redisPort: Number(process.env.CS_REDIS_PORT ?? "6379"),
    redisUsername: process.env.CS_REDIS_USERNAME,
    redisPassword: process.env.CS_REDIS_PASSWORD,
    redisDb: Number(process.env.CS_REDIS_DB ?? "0"),
    redisKeyPrefix: process.env.CS_REDIS_KEY_PREFIX ?? "collaboration-service:",
    apiGatewayUrl: trimTrailingSlash(
        process.env.CS_API_GATEWAY_URL ?? "http://localhost:8080",
    ),
    internalServiceApiKey: process.env.CS_INTERNAL_SERVICE_API_KEY ?? "",
    userAuthBatchPath:
        process.env.CS_USER_AUTH_BATCH_PATH ??
        "/user-service/v1/api/users/internal/authz/context/batch",
    questionSelectionPath:
        process.env.CS_QUESTION_SELECTION_PATH ??
        "/question-service/v1/api/questions/select",
    requestTimeoutMs: Number(process.env.CS_DEPENDENCY_TIMEOUT_MS ?? "5000"),
};
