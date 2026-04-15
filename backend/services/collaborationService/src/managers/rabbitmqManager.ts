import amqp, { type Channel, type ChannelModel } from "amqplib";
import type { Server } from "socket.io";

import { NON_RETRYABLE_ERROR_CODES, RABBITMQ_DEFAULTS, SOCKET_EVENTS } from "@/config/constants.js";
import { env } from "@/config/env.js";
import { AttemptRecordingService } from "@/services/attemptRecordingService.js";
import {
    collaborationSessionService,
    type CreateSessionResponse,
} from "@/services/collaborationSessionService.js";
import { validateCreateSessionPayload } from "@/services/validation.js";
import {
    EXEC_REQ_QUEUE,
    EXEC_RES_QUEUE,
    type ExecutionRequestMessage,
    type ExecutionResponseMessage,
} from "@/types/executionRabbitmq.js";
import { REQ_DELAY_QUEUE, REQ_QUEUE, RES_QUEUE } from "@/types/rabbitmq.js";
import { AppError } from "@/utils/errors.js";
import { logger } from "@/utils/logger.js";
import { getRedisClient } from "@/utils/redis.js";

const attemptRecordingService = new AttemptRecordingService();

function collaborationRoom(collaborationId: string): string {
    return `collaboration:${collaborationId}`;
}

function userRoom(userId: string): string {
    return `user:${userId}`;
}

export class RabbitMQManager {
    private static instance: RabbitMQManager;
    private connection: ChannelModel | null = null;
    private channel: Channel | null = null;
    private isReconnecting = false;
    private isShuttingDown = false;
    private io: Server | null = null;

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
            await ch.assertQueue(REQ_QUEUE, { durable: true });
            await ch.assertQueue(RES_QUEUE, { durable: true });
            await ch.assertQueue(EXEC_REQ_QUEUE, { durable: true });
            await ch.assertQueue(EXEC_RES_QUEUE, { durable: true });

            // Delay queue for session-creation retries with exponential backoff.
            // Messages sit here until their per-message TTL expires, then
            // dead-letter back into REQ_QUEUE for reprocessing.
            await ch.assertQueue(REQ_DELAY_QUEUE, {
                durable: true,
                deadLetterExchange: "",
                deadLetterRoutingKey: REQ_QUEUE,
            });

            logger.info("Connected to RabbitMQ successfully");

            this.startConsumingSessionRequests();

            // Start execution response consumer if io is available (set via startConsumers)
            if (this.io) {
                this.startConsumingExecutionResponses(this.io);
            }
        } catch (error) {
            logger.error({ err: error }, "Failed to connect to RabbitMQ");
            this.handleConnectionError(error as Error);
        }
    }

    /**
     * Start consumers that require the Socket.IO server instance.
     * Call this after creating the io server.
     */
    public startConsumers(io: Server): void {
        this.io = io;

        if (this.channel) {
            this.startConsumingExecutionResponses(io);
        }
    }

    private handleConnectionError(error: Error): void {
        if (this.isReconnecting || this.isShuttingDown) return;
        this.isReconnecting = true;

        logger.error({ err: error }, "RabbitMQ connection lost. Retrying in 5s...");

        this.connection = null;
        this.channel = null;

        setTimeout(() => {
            this.connect();
        }, RABBITMQ_DEFAULTS.RECONNECT_DELAY_MS);
    }

    private startConsumingSessionRequests(): void {
        const ch = this.channel;
        if (!ch) return;

        logger.info(`Listening for session creation requests on ${REQ_QUEUE}`);

        ch.consume(REQ_QUEUE, async (msg) => {
            if (!msg) return;

            const headers = msg.properties.headers || {};
            const retryCount = (headers["x-retry-count"] || 0) as number;

            let parsed: unknown;
            try {
                parsed = JSON.parse(msg.content.toString());
            } catch {
                logger.error("Discarding malformed message (invalid JSON)");
                ch.ack(msg);
                return;
            }

            const validation = validateCreateSessionPayload(parsed);
            if (!validation.valid) {
                logger.error({ error: validation.error }, "Discarding invalid session request");
                ch.ack(msg);
                return;
            }

            try {
                const response = await collaborationSessionService.createSession(validation.value);

                logger.info(
                    { collaborationId: response.session.collaborationId },
                    "Session created, publishing response",
                );

                const published = this.publishSessionResponse(response);
                if (!published) {
                    throw new Error("Failed to publish session creation response");
                }
                ch.ack(msg);
            } catch (error) {
                this.handleSessionConsumerError(ch, msg, error, retryCount, headers);
            }
        });
    }

    private startConsumingExecutionResponses(io: Server): void {
        const ch = this.channel;
        if (!ch) return;

        logger.info(`Listening for execution responses on ${EXEC_RES_QUEUE}`);

        ch.consume(EXEC_RES_QUEUE, async (msg) => {
            if (!msg) return;

            let parsed: ExecutionResponseMessage;
            try {
                parsed = JSON.parse(msg.content.toString()) as ExecutionResponseMessage;
            } catch {
                logger.error("Discarding malformed execution response (invalid JSON)");
                ch.ack(msg);
                return;
            }

            const { correlationId, collaborationId, userId, type: execType } = parsed;

            // Clear the pending timeout key in Redis (non-fatal if it fails)
            const redis = getRedisClient();
            try {
                await redis.del(`exec:pending:${correlationId}`);
            } catch (redisErr) {
                logger.warn(
                    { err: redisErr, correlationId, collaborationId },
                    "Failed to clear exec:pending key (timeout may fire spuriously)",
                );
            }

            try {
                if (parsed.success && parsed.result) {
                    // Store result in Redis
                    await collaborationSessionService.updateOutput(
                        collaborationId,
                        JSON.stringify(parsed.result),
                    );

                    // Broadcast results to all users in the room
                    io.to(collaborationRoom(collaborationId)).emit(
                        SOCKET_EVENTS.OUTPUT_UPDATED,
                        {
                            collaborationId,
                            output: parsed.result,
                        },
                    );

                    logger.info(
                        {
                            correlationId,
                            collaborationId,
                            testCasesPassed: parsed.result.testCasesPassed,
                            totalTestCases: parsed.result.totalTestCases,
                        },
                        "Execution result broadcast to room",
                    );

                    // For submissions, record the attempt and notify the submitter
                    if (execType === "submit") {
                        const allPassed =
                            parsed.result.testCasesPassed === parsed.result.totalTestCases &&
                            parsed.result.totalTestCases > 0;
                        const sessionStart = parsed.sessionCreatedAt
                            ? new Date(parsed.sessionCreatedAt).getTime()
                            : NaN;
                        const duration = Number.isNaN(sessionStart)
                            ? 0
                            : Math.max(0, Math.round((Date.now() - sessionStart) / 1000));
                        if (Number.isNaN(sessionStart)) {
                            logger.warn(
                                { correlationId, collaborationId, sessionCreatedAt: parsed.sessionCreatedAt },
                                "Invalid or missing sessionCreatedAt, using duration=0",
                            );
                        }

                        // Send submission confirmation to the submitter regardless of attempt recording
                        io.to(userRoom(userId)).emit(
                            SOCKET_EVENTS.SUBMISSION_COMPLETE,
                            {
                                collaborationId,
                                success: allPassed,
                                totalTestCases: parsed.result.totalTestCases,
                                testCasesPassed: parsed.result.testCasesPassed,
                            },
                        );

                        try {
                            await attemptRecordingService.recordAttempt({
                                userId,
                                collaborationId,
                                questionId: parsed.questionId,
                                questionTitle: parsed.questionTitle,
                                language: parsed.language,
                                difficulty: parsed.difficulty,
                                success: allPassed,
                                duration,
                                totalTestCases: parsed.result.totalTestCases,
                                testCasesPassed: parsed.result.testCasesPassed,
                            });
                        } catch (attemptError) {
                            logger.error(
                                { err: attemptError, correlationId, collaborationId },
                                "Failed to record attempt after execution",
                            );
                        }
                    }
                } else {
                    // Execution failed — broadcast error to stop spinners
                    io.to(collaborationRoom(collaborationId)).emit(
                        SOCKET_EVENTS.OUTPUT_UPDATED,
                        {
                            collaborationId,
                            output: { error: parsed.error ?? "Code execution failed." },
                        },
                    );

                    logger.error(
                        { correlationId, collaborationId, error: parsed.error },
                        "Execution error broadcast to room",
                    );
                }

                ch.ack(msg);
            } catch (error) {
                logger.error(
                    { err: error, correlationId, collaborationId },
                    "Failed to process execution response",
                );
                // Ack anyway to avoid reprocessing — the result would be the same
                ch.ack(msg);
            }
        });
    }

    public publishExecutionRequest(message: ExecutionRequestMessage): boolean {
        if (!this.channel) return false;

        try {
            return this.channel.sendToQueue(
                EXEC_REQ_QUEUE,
                Buffer.from(JSON.stringify(message)),
                { persistent: true },
            );
        } catch (error) {
            logger.error({ err: error }, "Failed to publish execution request");
            return false;
        }
    }

    private handleSessionConsumerError(
        ch: Channel,
        msg: amqp.ConsumeMessage,
        error: unknown,
        retryCount: number,
        headers: Record<string, unknown>,
    ): void {
        const isNonRetryable =
            error instanceof AppError && NON_RETRYABLE_ERROR_CODES.has(error.code);

        if (isNonRetryable) {
            logger.warn(
                { err: error, code: (error as AppError).code },
                "Non-retryable error, discarding message",
            );
            this.publishSessionFailure(msg, (error as AppError).message);
            ch.ack(msg);
            return;
        }

        logger.error({ err: error, retryCount }, "Failed to process session creation request");

        if (retryCount < RABBITMQ_DEFAULTS.MAX_RETRIES) {
            // Exponential backoff: 2s, 4s, 8s, 16s, 32s
            const delayMs = RABBITMQ_DEFAULTS.RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);

            logger.warn(
                { retryCount: retryCount + 1, maxRetries: RABBITMQ_DEFAULTS.MAX_RETRIES, delayMs },
                "Scheduling retry with backoff",
            );

            // Publish to the delay queue with a per-message TTL.
            // When the TTL expires the broker dead-letters the message
            // back into REQ_QUEUE for reprocessing.
            const requeued = ch.sendToQueue(REQ_DELAY_QUEUE, msg.content, {
                headers: { ...headers, "x-retry-count": retryCount + 1 },
                persistent: true,
                expiration: String(delayMs),
            });

            if (requeued) {
                ch.ack(msg);
            } else {
                // Backpressure: nack so the broker retains the message
                logger.warn("sendToQueue returned false (backpressure), nacking for redelivery");
                ch.nack(msg, false, true);
            }
        } else {
            logger.error("Max retries reached. Discarding message.");
            this.publishSessionFailure(msg, "Session creation failed after maximum retries.");
            ch.nack(msg, false, false);
        }
    }

    private publishSessionFailure(msg: amqp.ConsumeMessage, errorMessage: string): void {
        if (!this.channel) return;

        try {
            const payload = JSON.parse(msg.content.toString());
            const { userAId, userBId } = payload;
            if (!userAId || !userBId) return;

            this.channel.sendToQueue(
                RES_QUEUE,
                Buffer.from(JSON.stringify({ error: true, userAId, userBId, message: errorMessage })),
                { persistent: true },
            );
            logger.info({ userAId, userBId }, "Published session failure response");
        } catch (err) {
            logger.error({ err }, "Failed to publish session failure response");
        }
    }

    private publishSessionResponse(response: CreateSessionResponse): boolean {
        if (!this.channel) return false;

        try {
            return this.channel.sendToQueue(
                RES_QUEUE,
                Buffer.from(JSON.stringify(response)),
                { persistent: true },
            );
        } catch (error) {
            logger.error({ err: error }, "Failed to publish session creation response");
            return false;
        }
    }

    public async close(): Promise<void> {
        this.isShuttingDown = true;
        await this.channel?.close();
        await this.connection?.close();
        this.channel = null;
        this.connection = null;
    }
}
