import { ERROR_CODES, HTTP_STATUS } from "@/config/constants.js";
import { env } from "@/config/env.js";
import type { UserValidationRecord } from "@/models/session.js";
import { AppError } from "@/utils/errors.js";

type BatchValidationResponse = {
    data?: {
        users?: UserValidationRecord[];
    };
};

export class UserValidationService {
    async validateUsers(userIds: string[]): Promise<UserValidationRecord[]> {
        const response = await this.fetchUserValidation(userIds);
        const validatedUsers = response.data?.users ?? [];

        if (validatedUsers.length !== userIds.length) {
            throw new AppError(
                ERROR_CODES.USER_VALIDATION_FAILED,
                HTTP_STATUS.FORBIDDEN,
                "One or more matched users could not be validated.",
                { userIds },
            );
        }

        const invalidUsers = validatedUsers.filter((user) => user.status !== "active");
        if (invalidUsers.length > 0) {
            throw new AppError(
                ERROR_CODES.USER_VALIDATION_FAILED,
                HTTP_STATUS.FORBIDDEN,
                "One or more matched users are not active.",
                { invalidUsers },
            );
        }

        return validatedUsers;
    }

    private async fetchUserValidation(userIds: string[]): Promise<BatchValidationResponse> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), env.dependencyTimeoutMs);

        try {
            const response = await fetch(`${env.userServiceUrl}${env.userAuthBatchPath}`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-internal-service-key": env.internalServiceApiKey,
                },
                body: JSON.stringify({ userIds }),
                signal: controller.signal,
            });

            const payload = (await response
                .json()
                .catch(() => null)) as BatchValidationResponse | null;

            if (!response.ok) {
                throw new AppError(
                    ERROR_CODES.USER_SERVICE_UNAVAILABLE,
                    HTTP_STATUS.FAILED_DEPENDENCY,
                    "User validation dependency failed.",
                    {
                        statusCode: response.status,
                        payload,
                    },
                );
            }

            return payload ?? {};
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }

            throw new AppError(
                ERROR_CODES.USER_SERVICE_UNAVAILABLE,
                HTTP_STATUS.FAILED_DEPENDENCY,
                "User validation dependency is unavailable.",
            );
        } finally {
            clearTimeout(timeout);
        }
    }
}
