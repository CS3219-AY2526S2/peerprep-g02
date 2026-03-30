import { env } from "@/config/env.js";
import { logger } from "@/utils/logger.js";

export type RecordAttemptPayload = {
    userId: string;
    collaborationId: string;
    questionId: string;
    questionTitle: string;
    language: string;
    difficulty: string;
    success: boolean;
    duration: number;
    totalTestCases: number;
    testCasesPassed: number;
};

export class AttemptRecordingService {
    async recordAttempt(payload: RecordAttemptPayload): Promise<void> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), env.dependencyTimeoutMs);

        try {
            const response = await fetch(`${env.attemptServiceUrl}/attempts`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-internal-service-key": env.internalServiceApiKey,
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => null);
                logger.error(
                    { statusCode: response.status, errorPayload },
                    "Failed to record attempt",
                );
                throw new Error(`Attempt service error: ${response.status}`);
            }

            logger.info(
                {
                    questionId: payload.questionId,
                    success: payload.success,
                    testCasesPassed: payload.testCasesPassed,
                    totalTestCases: payload.totalTestCases,
                },
                "Attempt recorded successfully",
            );
        } finally {
            clearTimeout(timeout);
        }
    }
}
