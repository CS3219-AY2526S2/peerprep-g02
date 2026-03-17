import { AuthenticatedUser } from "@/models/models.js";
import { collaborationConfig } from "@/services/config.js";
import {
    DependencyUnavailableError,
    gatewayFetch,
} from "@/services/httpClient.js";

type UserAuthGatewayResponse = {
    data?: {
        users?: Array<{
            clerkUserId?: string;
            status?: string;
        }>;
    };
};

export class UserGatewayClient {
    async validateAuthenticatedUsers(userIds: string[]): Promise<AuthenticatedUser[]> {
        const response = await gatewayFetch(collaborationConfig.userAuthBatchPath, {
            method: "POST",
            headers: {
                "x-internal-service-key": collaborationConfig.internalServiceApiKey,
            },
            body: JSON.stringify({
                userIds,
            }),
        });

        if (response.status >= 500) {
            throw new DependencyUnavailableError(
                `User Service returned ${response.status}.`,
            );
        }

        if (response.status === 401 || response.status === 403 || response.status === 404) {
            return userIds.map((userId) => ({
                userId,
                isAuthenticated: false,
            }));
        }

        if (!response.ok) {
            throw new DependencyUnavailableError(
                `User Service returned ${response.status}.`,
            );
        }

        const payload = (await response.json()) as UserAuthGatewayResponse;
        const usersById = new Map(
            (payload.data?.users ?? []).map((user) => [
                user.clerkUserId ?? "",
                user.status,
            ]),
        );

        return userIds.map((userId) => {
            const status = usersById.get(userId);

            return {
                userId,
                isAuthenticated: status === "active",
                status,
            };
        });
    }
}
