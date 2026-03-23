import { ERROR_CODES, HTTP_STATUS } from "@/config/constants.js";
import { env } from "@/config/env.js";
import type { CreateSessionRequest, QuestionDetails, SelectedQuestion } from "@/models/session.js";
import { AppError } from "@/utils/errors.js";
import { logger } from "@/utils/logger.js";

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

type QuestionDetailsResponse = {
    data?: {
        question?: {
            quid?: string;
            title?: string;
            description?: string;
            difficulty?: string;
            topics?: string[];
            testCase?: Array<{ input: unknown; output: unknown }>;
        };
    };
};

export class QuestionSelectionService {
    async selectQuestion(request: CreateSessionRequest): Promise<SelectedQuestion> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), env.dependencyTimeoutMs);

        try {
            const response = await fetch(`${env.questionsServiceUrl}${env.questionSelectionPath}`, {
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

    async getQuestionDetails(questionId: string): Promise<QuestionDetails | null> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), env.dependencyTimeoutMs);

        try {
            const response = await fetch(`${env.questionsServiceUrl}${env.questionDetailsPath}`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-internal-service-key": env.internalServiceApiKey,
                },
                body: JSON.stringify({ questionId }),
                signal: controller.signal,
            });

            const payload = (await response.json().catch(() => null)) as QuestionDetailsResponse | null;

            if (!response.ok) {
                logger.warn(
                    { questionId, statusCode: response.status },
                    "Failed to fetch question details",
                );
                return null;
            }

            const question = payload?.data?.question;
            if (!question?.quid) {
                return null;
            }

            return {
                quid: question.quid,
                title: question.title ?? "",
                description: question.description ?? "",
                difficulty: question.difficulty ?? "",
                topics: question.topics ?? [],
                testCase: (question.testCase ?? []).map((tc) => ({
                    input: typeof tc.input === "string" ? tc.input : JSON.stringify(tc.input),
                    output: typeof tc.output === "string" ? tc.output : JSON.stringify(tc.output),
                })),
            };
        } catch (error) {
            logger.error({ err: error, questionId }, "Error fetching question details");
            return null;
        } finally {
            clearTimeout(timeout);
        }
    }
}
