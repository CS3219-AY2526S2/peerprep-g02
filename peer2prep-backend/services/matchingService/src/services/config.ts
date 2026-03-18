const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

export const matchingConfig = {
    apiGatewayUrl: trimTrailingSlash(
        process.env.MS_API_GATEWAY_URL ?? "http://localhost:8080",
    ),
    collaborationSessionPath:
        process.env.MS_COLLABORATION_SESSION_PATH ?? "/v1/api/collaboration/sessions",
    dependencyTimeoutMs: Number(process.env.MS_DEPENDENCY_TIMEOUT_MS ?? "5000"),
};
