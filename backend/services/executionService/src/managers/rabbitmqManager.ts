import amqp, { type Channel, type ChannelModel } from "amqplib";

import { RABBITMQ_DEFAULTS, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/config/constants.js";
import { env } from "@/config/env.js";
import { executeCode } from "@/services/executionService.js";
import {
    EXEC_REQ_QUEUE,
    EXEC_RES_QUEUE,
    type ExecutionRequestMessage,
    type ExecutionResponseMessage,
} from "@/types/rabbitmq.js";
import { logger } from "@/utils/logger.js";

export class RabbitMQManager {
    private static instance: RabbitMQManager;
    private connection: ChannelModel | null = null;
    private channel: Channel | null = null;
    private isReconnecting = false;

    private constructor() {}

    public static getInstance(): RabbitMQManager {
        if (!RabbitMQManager.instance) {
            RabbitMQManager.instance = new RabbitMQManager();
        }
        return RabbitMQManager.instance;
    }

    public async connect(): Promise<void> {
        try {
            const conn = await amqp.connect(env.rabbitmqUrl);
            const ch = await conn.createChannel();

            this.connection = conn;
            this.channel = ch;
            this.isReconnecting = false;

            conn.on("error", (err) => this.handleConnectionError(err));
            conn.on("close", () =>
                this.handleConnectionError(new Error("RabbitMQ connection closed")),
            );

            await ch.prefetch(RABBITMQ_DEFAULTS.PREFETCH_COUNT);
            await ch.assertQueue(EXEC_REQ_QUEUE, { durable: true });
            await ch.assertQueue(EXEC_RES_QUEUE, { durable: true });

            logger.info("Connected to RabbitMQ successfully");

            this.startConsuming();
        } catch (error) {
            logger.error({ err: error }, "Failed to connect to RabbitMQ");
            this.handleConnectionError(error as Error);
        }
    }

    private handleConnectionError(error: Error): void {
        if (this.isReconnecting) return;
        this.isReconnecting = true;

        logger.error({ err: error }, "RabbitMQ connection lost. Retrying in 5s...");

        this.connection = null;
        this.channel = null;

        setTimeout(() => {
            this.connect();
        }, RABBITMQ_DEFAULTS.RECONNECT_DELAY_MS);
    }

    private startConsuming(): void {
        const ch = this.channel;
        if (!ch) return;

        logger.info(`Listening for execution requests on ${EXEC_REQ_QUEUE}`);

        ch.consume(EXEC_REQ_QUEUE, async (msg) => {
            if (!msg) return;

            const headers = msg.properties.headers || {};
            const retryCount = (headers["x-retry-count"] || 0) as number;

            let parsed: ExecutionRequestMessage;
            try {
                parsed = JSON.parse(msg.content.toString()) as ExecutionRequestMessage;
            } catch {
                logger.error("Discarding malformed message (invalid JSON)");
                ch.ack(msg);
                return;
            }

            // Validate required fields
            if (!parsed.correlationId || !parsed.collaborationId || !parsed.code || !parsed.language || !parsed.functionName) {
                logger.error({ correlationId: parsed.correlationId }, "Discarding invalid execution request (missing fields)");
                this.publishErrorResponse(parsed, "Invalid execution request: missing required fields");
                ch.ack(msg);
                return;
            }

            // Validate language
            if (!SUPPORTED_LANGUAGES.includes(parsed.language as SupportedLanguage)) {
                logger.error({ language: parsed.language }, "Unsupported language");
                this.publishErrorResponse(parsed, `Unsupported language: ${parsed.language}. Supported: ${SUPPORTED_LANGUAGES.join(", ")}`);
                ch.ack(msg);
                return;
            }

            if (!Array.isArray(parsed.testCases) || parsed.testCases.length === 0) {
                logger.error({ correlationId: parsed.correlationId }, "Empty or missing test cases");
                this.publishErrorResponse(parsed, "testCases must be a non-empty array");
                ch.ack(msg);
                return;
            }

            try {
                logger.info(
                    {
                        correlationId: parsed.correlationId,
                        collaborationId: parsed.collaborationId,
                        language: parsed.language,
                        testCaseCount: parsed.testCases.length,
                    },
                    "Processing execution request",
                );

                const result = await executeCode(
                    parsed.code,
                    parsed.language as SupportedLanguage,
                    parsed.functionName,
                    parsed.testCases,
                );

                const response: ExecutionResponseMessage = {
                    correlationId: parsed.correlationId,
                    collaborationId: parsed.collaborationId,
                    userId: parsed.userId,
                    type: parsed.type,
                    questionId: parsed.questionId,
                    questionTitle: parsed.questionTitle,
                    language: parsed.language,
                    difficulty: parsed.difficulty,
                    sessionCreatedAt: parsed.sessionCreatedAt,
                    success: true,
                    result,
                };

                const published = this.publishResponse(response);
                if (!published) {
                    throw new Error("Failed to publish execution response");
                }

                logger.info(
                    {
                        correlationId: parsed.correlationId,
                        testCasesPassed: result.testCasesPassed,
                        totalTestCases: result.totalTestCases,
                    },
                    "Execution completed, response published",
                );

                ch.ack(msg);
            } catch (error) {
                this.handleConsumerError(ch, msg, parsed, error, retryCount, headers);
            }
        });
    }

    private handleConsumerError(
        ch: Channel,
        msg: amqp.ConsumeMessage,
        request: ExecutionRequestMessage,
        error: unknown,
        retryCount: number,
        headers: Record<string, unknown>,
    ): void {
        logger.error(
            { err: error, retryCount, correlationId: request.correlationId },
            "Failed to process execution request",
        );

        if (retryCount < RABBITMQ_DEFAULTS.MAX_RETRIES) {
            logger.warn(
                `Retrying message (${retryCount + 1}/${RABBITMQ_DEFAULTS.MAX_RETRIES})...`,
            );

            ch.sendToQueue(EXEC_REQ_QUEUE, msg.content, {
                headers: { ...headers, "x-retry-count": retryCount + 1 },
                persistent: true,
            });

            ch.ack(msg);
        } else {
            logger.error("Max retries reached. Publishing error response.");
            this.publishErrorResponse(
                request,
                "Code execution failed after maximum retries.",
            );
            ch.nack(msg, false, false);
        }
    }

    private publishErrorResponse(request: Partial<ExecutionRequestMessage>, errorMessage: string): void {
        const response: ExecutionResponseMessage = {
            correlationId: request.correlationId ?? "",
            collaborationId: request.collaborationId ?? "",
            userId: request.userId ?? "",
            type: request.type ?? "run",
            questionId: request.questionId ?? "",
            questionTitle: request.questionTitle ?? "",
            language: request.language ?? "",
            difficulty: request.difficulty ?? "",
            sessionCreatedAt: request.sessionCreatedAt ?? "",
            success: false,
            error: errorMessage,
        };
        this.publishResponse(response);
    }

    private publishResponse(response: ExecutionResponseMessage): boolean {
        if (!this.channel) return false;

        try {
            return this.channel.sendToQueue(
                EXEC_RES_QUEUE,
                Buffer.from(JSON.stringify(response)),
                { persistent: true },
            );
        } catch (error) {
            logger.error({ err: error }, "Failed to publish execution response");
            return false;
        }
    }

    public async close(): Promise<void> {
        await this.channel?.close();
        await this.connection?.close();
    }
}
