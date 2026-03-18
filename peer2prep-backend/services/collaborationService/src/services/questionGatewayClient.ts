/** Retrieves question selection data directly from Question Service. */
import {
    QuestionSummary,
    SessionDifficulty,
} from "@/models/models.js";
import { DependencyUnavailableError } from "@/services/httpClient.js";
import { collaborationConfig } from "@/services/config.js";

type QuestionGatewayResponse = {
    data?: {
        questionId?: string;
        id?: string;
    };
    questionId?: string;
    id?: string;
};

export class QuestionGatewayClient {
    async getQuestion(
        topic: string,
        difficulty: SessionDifficulty,
    ): Promise<QuestionSummary> {
        if (collaborationConfig.useQuestionStub) {
            const normalizedTopic = topic
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");

            return {
                questionId: [
                    collaborationConfig.stubQuestionPrefix,
                    normalizedTopic || "general",
                    difficulty.toLowerCase(),
                ].join("-"),
            };
        }

        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            collaborationConfig.requestTimeoutMs,
        );

        let response: Response;

        try {
            response = await fetch(
                `${collaborationConfig.questionServiceUrl}${collaborationConfig.questionSelectionPath}`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        topic,
                        difficulty,
                    }),
                    signal: controller.signal,
                    headers: {
                        "content-type": "application/json",
                    },
                },
            );
        } catch (error) {
            throw new DependencyUnavailableError(
                error instanceof Error ? error.message : "Dependency request failed.",
            );
        } finally {
            clearTimeout(timeout);
        }

        if (!response.ok) {
            throw new DependencyUnavailableError(
                `Question Service returned ${response.status}.`,
            );
        }

        const payload = (await response.json()) as QuestionGatewayResponse;
        const questionId = payload.data?.questionId ?? payload.data?.id ?? payload.questionId ?? payload.id;

        if (!questionId) {
            throw new DependencyUnavailableError(
                "Question Service response did not include a question identifier.",
            );
        }

        return { questionId };
    }
}
