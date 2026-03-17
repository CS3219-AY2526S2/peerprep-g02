import {
    QuestionSummary,
    SessionDifficulty,
} from "@/models/models.js";
import {
    DependencyUnavailableError,
    gatewayFetch,
} from "@/services/httpClient.js";
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
        const response = await gatewayFetch(collaborationConfig.questionSelectionPath, {
            method: "POST",
            body: JSON.stringify({
                topic,
                difficulty,
            }),
        });

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
