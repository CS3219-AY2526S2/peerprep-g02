import { env } from "@/config/env.js";
import { logger } from "@/utils/logger.js";

type TestCase = {
    input: unknown;
    output: unknown;
};

export type TestCaseResult = {
    testCaseIndex: number;
    passed: boolean;
    actualOutput: string;
    expectedOutput: string;
    error?: string;
    executionTimeMs: number;
};

export type ExecutionResponse = {
    results: TestCaseResult[];
    totalTestCases: number;
    testCasesPassed: number;
    stderr: string;
};

export class CodeExecutionService {
    async execute(
        code: string,
        language: string,
        functionName: string,
        testCases: TestCase[],
    ): Promise<ExecutionResponse> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60_000); // 60s total timeout

        try {
            const response = await fetch(`${env.executionServiceUrl}/execute`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-internal-service-key": env.internalServiceApiKey,
                },
                body: JSON.stringify({
                    code,
                    language: language.toLowerCase(),
                    functionName,
                    testCases,
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => null);
                logger.error(
                    { statusCode: response.status, errorPayload },
                    "Execution service returned error",
                );
                throw new Error(
                    `Execution service error: ${response.status}`,
                );
            }

            return (await response.json()) as ExecutionResponse;
        } finally {
            clearTimeout(timeout);
        }
    }
}
