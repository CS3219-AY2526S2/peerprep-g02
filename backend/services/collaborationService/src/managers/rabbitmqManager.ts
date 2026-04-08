import amqp, { type Channel, type ChannelModel } from "amqplib";

import { NON_RETRYABLE_ERROR_CODES, RABBITMQ_DEFAULTS } from "@/config/constants.js";
import { env } from "@/config/env.js";
import {
    collaborationSessionService,
    type CreateSessionResponse,
} from "@/services/collaborationSessionService.js";
import { validateCreateSessionPayload } from "@/services/validation.js";
import { REQ_QUEUE, RES_QUEUE } from "@/types/rabbitmq.js";
import { AppError } from "@/utils/errors.js";
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
            await ch.assertQueue(REQ_QUEUE, { durable: true });
            await ch.assertQueue(RES_QUEUE, { durable: true });

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

                this.publishResponse(response);
                ch.ack(msg);
            } catch (error) {
                this.handleConsumerError(ch, msg, error, retryCount, headers);
            }
        });
    }

    private handleConsumerError(
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
            ch.ack(msg);
            return;
        }

        logger.error({ err: error, retryCount }, "Failed to process session creation request");

        if (retryCount < RABBITMQ_DEFAULTS.MAX_RETRIES) {
            logger.warn(
                `Retrying message (${retryCount + 1}/${RABBITMQ_DEFAULTS.MAX_RETRIES})...`,
            );

            ch.sendToQueue(REQ_QUEUE, msg.content, {
                headers: { ...headers, "x-retry-count": retryCount + 1 },
                persistent: true,
            });

            ch.ack(msg);
        } else {
            logger.error("Max retries reached. Discarding message.");
            ch.nack(msg, false, false);
        }
    }

    private publishResponse(response: CreateSessionResponse): boolean {
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
        await this.channel?.close();
        await this.connection?.close();
    }
}
