import { authLogger } from "@/utils/logger.js";

type UserAuthStatusResponse = {
    data?: {
        clerkUserId?: string;
        role?: string;
        status?: string;
    };
};

type UserContextResult =
    | { ok: true; userId: string; role?: string }
    | { ok: false; reason: "unauthenticated" }
    | { ok: false; userId: string; reason: "dependency_error"; message: string };

const userServiceBaseUrl = process.env.CS_USER_SERVICE_URL ?? "http://user-service:3001";
const internalServiceApiKey = process.env.INTERNAL_SERVICE_API_KEY ?? "";

type UserStatusLookupResponse = {
    data?: {
        clerkUserId?: string;
        role?: string;
        status?: string;
    };
};

export async function fetchAuthenticatedUserContext(
    authHeader: string | undefined,
): Promise<UserContextResult> {
    if (!authHeader) {
        return { ok: false, reason: "unauthenticated" };
    }

    try {
        const response = await fetch(`${userServiceBaseUrl}/v1/api/users/internal/authz/context`, {
            method: "GET",
            headers: {
                authorization: authHeader,
                "x-internal-service-key": internalServiceApiKey,
            },
        });

        if (response.status === 401 || response.status === 403) {
            return { ok: false, reason: "unauthenticated" };
        }

        if (!response.ok) {
            authLogger.error(
                { statusCode: response.status },
                "Authenticated user context lookup failed due to user service error response",
            );
            return {
                ok: false,
                userId: "unknown",
                reason: "dependency_error",
                message: `User service returned ${response.status}.`,
            };
        }

        const payload = (await response.json()) as UserAuthStatusResponse;
        if (!payload.data?.clerkUserId || payload.data.status !== "active") {
            return { ok: false, reason: "unauthenticated" };
        }

        return {
            ok: true,
            userId: payload.data.clerkUserId,
            role: payload.data.role,
        };
    } catch (error) {
        authLogger.error({ err: error }, "Authenticated user context lookup failed due to dependency error");
        return {
            ok: false,
            userId: "unknown",
            reason: "dependency_error",
            message: error instanceof Error ? error.message : "Unknown dependency error.",
        };
    }
}

type AuthStatusResult =
    | { ok: true; userId: string }
    | { ok: false; userId: string; reason: "unauthenticated" }
    | { ok: false; userId: string; reason: "dependency_error"; message: string };

async function fetchUserAuthStatus(userId: string): Promise<AuthStatusResult> {
    try {
        const response = await fetch(
            `${userServiceBaseUrl}/v1/api/users/internal/authz/users/${encodeURIComponent(userId)}/status`,
            {
                method: "GET",
                headers: {
                    "x-internal-service-key": internalServiceApiKey,
                },
            },
        );

        if (response.status === 404) {
            return { ok: false, userId, reason: "unauthenticated" };
        }

        if (!response.ok) {
            authLogger.error(
                { userId, statusCode: response.status },
                "User authentication check failed due to user service error response",
            );
            return {
                ok: false,
                userId,
                reason: "dependency_error",
                message: `User service returned ${response.status}.`,
            };
        }

        const payload = (await response.json()) as UserStatusLookupResponse;
        if (payload.data?.clerkUserId !== userId || payload.data?.status !== "active") {
            return { ok: false, userId, reason: "unauthenticated" };
        }

        return { ok: true, userId };
    } catch (error) {
        authLogger.error({ err: error, userId }, "User authentication check failed due to dependency error");
        return {
            ok: false,
            userId,
            reason: "dependency_error",
            message: error instanceof Error ? error.message : "Unknown dependency error.",
        };
    }
}

export type VerifyUsersAuthenticationResult =
    | { valid: true }
    | { valid: false; errorType: "AUTHENTICATION_FAILED"; failedUserIds: string[] }
    | { valid: false; errorType: "SERVICE_DEPENDENCY_ERROR"; message: string };

export async function verifyUsersAuthentication(
    userIds: readonly string[],
): Promise<VerifyUsersAuthenticationResult> {
    const uniqueUserIds = [...new Set(userIds)];
    const results = await Promise.all(uniqueUserIds.map(fetchUserAuthStatus));
    const dependencyFailure = results.find((result) => !result.ok && result.reason === "dependency_error");

    if (dependencyFailure && !dependencyFailure.ok) {
        return {
            valid: false,
            errorType: "SERVICE_DEPENDENCY_ERROR",
            message: dependencyFailure.message,
        };
    }

    const failedUserIds = results
        .filter((result) => !result.ok && result.reason === "unauthenticated")
        .map((result) => result.userId);

    if (failedUserIds.length > 0) {
        return {
            valid: false,
            errorType: "AUTHENTICATION_FAILED",
            failedUserIds,
        };
    }

    return { valid: true };
}
