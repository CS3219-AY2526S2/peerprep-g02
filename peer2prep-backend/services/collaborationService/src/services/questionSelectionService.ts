import { ERROR_CODES, HTTP_STATUS } from "@/config/constants.js";
import { env } from "@/config/env.js";
import type { CreateSessionRequest, SelectedQuestion } from "@/models/session.js";
import { AppError } from "@/utils/errors.js";

type QuestionSelectionResponse = {
    data?: {
        question?: {
            questionId?: string;
            quid?: string;
            title?: string;
            topic?: string;
            difficulty?: CreateSessionRequest["difficulty"];
        };
    };
    body?: {
        questionId?: string;
        quid?: string;
        title?: string;
        topic?: string;
        difficulty?: CreateSessionRequest["difficulty"];
    };
};

export class QuestionSelectionService {
    async selectQuestion(request: CreateSessionRequest): Promise<SelectedQuestion> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), env.dependencyTimeoutMs);

        try {
            const response = await fetch(`${env.apiGatewayUrl}${env.questionSelectionPath}`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-internal-service-key": env.internalServiceApiKey,
                },
                body: JSON.stringify({
                    topic: request.topic,
                    difficulty: request.difficulty,
                    userAId: request.userAId,
                    userBId: request.userBId,
                }),
                signal: controller.signal,
            });

            const payload = (await response.json().catch(() => null)) as QuestionSelectionResponse | null;
            if (!response.ok) {
                throw new AppError(
                    ERROR_CODES.QUESTION_SERVICE_UNAVAILABLE,
                    HTTP_STATUS.FAILED_DEPENDENCY,
                    "Question selection dependency failed.",
                    {
                        statusCode: response.status,
                        payload,
                    },
                );
            }

            const question = payload?.data?.question ?? payload?.body;
            const questionId = question?.questionId ?? question?.quid;

            if (!questionId) {
                throw new AppError(
                    ERROR_CODES.QUESTION_NOT_FOUND,
                    HTTP_STATUS.NOT_FOUND,
                    "No question is available for the selected topic and difficulty.",
                    {
                        topic: request.topic,
                        difficulty: request.difficulty,
                    },
                );
            }

            return {
                questionId,
                topic: question?.topic ?? request.topic,
                difficulty: question?.difficulty ?? request.difficulty,
                title: question?.title,
            };
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }

            throw new AppError(
                ERROR_CODES.QUESTION_SERVICE_UNAVAILABLE,
                HTTP_STATUS.FAILED_DEPENDENCY,
                "Question selection dependency is unavailable.",
            );
        } finally {
            clearTimeout(timeout);
        }
    }
}
