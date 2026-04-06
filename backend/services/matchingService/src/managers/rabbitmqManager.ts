import amqp, { type Channel, type ChannelModel } from "amqplib";
import { Server } from "socket.io";

import type {
    CollaborationSuccessPayload,
    CreateSessionRequest,
    CreateSessionResponse,
} from "@/types/collab.js";
import { REQ_QUEUE, RES_QUEUE } from "@/types/rabbitmq.js";
import { rabbitMQLogger } from "@/utils/logger.js";

export class RabbitMQManager {
    private static instance: RabbitMQManager;
    private connection: ChannelModel | null = null;
    private channel: Channel | null = null;
    private io: Server | null = null;
    private isReconnecting = false;
    private readonly MAX_RETRIES = 5;

    private constructor() {}

    public static getInstance(): RabbitMQManager {
        if (!RabbitMQManager.instance) {
            RabbitMQManager.instance = new RabbitMQManager();
        }
        return RabbitMQManager.instance;
    }

    public async connect(io: Server): Promise<void> {
        this.io = io;
        const url = process.env.RABBITMQ_URL || "amqp://localhost:5672";

        try {
            const conn = await amqp.connect(url);
            const ch = await conn.createChannel();

            this.connection = conn;
            this.channel = ch;
            this.isReconnecting = false;

            conn.on("error", (err) => this.handleConnectionError(err));
            conn.on("close", () => this.handleConnectionError(new Error("Connection closed")));

            await ch.prefetch(1);

            await ch.assertQueue(REQ_QUEUE, { durable: true });
            await ch.assertQueue(RES_QUEUE, { durable: true });

            rabbitMQLogger.info("Connected to RabbitMQ successfully");

            this.startListening(io);
        } catch (error) {
            rabbitMQLogger.error({ error }, "Failed to connect to RabbitMQ");
            this.handleConnectionError(error as Error);
        }
    }

    private handleConnectionError(error: Error) {
        if (this.isReconnecting) return;
        this.isReconnecting = true;

        rabbitMQLogger.error({ error }, "RabbitMQ connection lost. Retrying in 5s...");

        this.connection = null;
        this.channel = null;

        setTimeout(() => {
            if (this.io) this.connect(this.io);
        }, 5000);
    }

    public async publishCreateSession(payload: CreateSessionRequest): Promise<boolean> {
        if (!this.channel) return false;

        try {
            rabbitMQLogger.info({ payload }, "Publishing match request to RabbitMQ");
            return this.channel.sendToQueue(REQ_QUEUE, Buffer.from(JSON.stringify(payload)), {
                persistent: true,
            });
        } catch (error) {
            rabbitMQLogger.error({ error }, "Failed to publish match request");
            return false;
        }
    }

    private startListening(io: Server) {
        const ch = this.channel;
        if (!ch) return;

        rabbitMQLogger.info(`Listening for messages on ${RES_QUEUE}`);

        ch.consume(RES_QUEUE, async (msg) => {
            if (!msg) return;

            const headers = msg.properties.headers || {};
            const retryCount = (headers["x-retry-count"] || 0) as number;

            try {
                const response: CreateSessionResponse = JSON.parse(msg.content.toString());

                rabbitMQLogger.info(
                    { collaborationId: response.session.collaborationId },
                    "Received room ready confirmation from Collab",
                );

                const sharedSessionData = {
                    matchFound: true,
                    ...(response.session.matchId && { matchId: response.session.matchId }),
                    collaborationId: response.session.collaborationId,
                    matchedTopic: response.session.topic,
                    matchedDifficulty: response.session.difficulty,
                    matchedLanguage: response.session.language,
                };

                io.to(response.session.userAId).emit("match_success", {
                    ...sharedSessionData,
                    userId: response.session.userAId,
                    partnerId: response.session.userBId,
                });

                io.to(response.session.userBId).emit("match_success", {
                    ...sharedSessionData,
                    userId: response.session.userBId,
                    partnerId: response.session.userAId,
                });

                ch.ack(msg);
            } catch (error) {
                rabbitMQLogger.error({ error, retryCount }, "Failed to process Collab response");

                // If it's a JSON parse error (poison message), don't retry, just discard
                if (error instanceof SyntaxError) {
                    rabbitMQLogger.error("Discarding malformed message");
                    return ch.ack(msg);
                }

                if (retryCount < this.MAX_RETRIES) {
                    // Retry: Re-publish to the same queue with incremented retry count
                    rabbitMQLogger.warn(
                        `Retrying message (${retryCount + 1}/${this.MAX_RETRIES})...`,
                    );

                    ch.sendToQueue(RES_QUEUE, msg.content, {
                        headers: { ...headers, "x-retry-count": retryCount + 1 },
                        persistent: true,
                    });

                    ch.ack(msg); // Ack the current one because we've "moved" it to a new one
                } else {
                    rabbitMQLogger.error("Max retries reached. Message lost.");
                    ch.nack(msg, false, false); // Final discard
                }
            }
        });
    }

    public async close(): Promise<void> {
        await this.channel?.close();
        await this.connection?.close();
    }
}
