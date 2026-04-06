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

    private constructor() {}

    public static getInstance(): RabbitMQManager {
        if (!RabbitMQManager.instance) {
            RabbitMQManager.instance = new RabbitMQManager();
        }
        return RabbitMQManager.instance;
    }

    public async connect(io: Server): Promise<void> {
        const url = process.env.RABBITMQ_URL || "amqp://localhost:5672";
        try {
            const conn = await amqp.connect(url);
            const ch = await conn.createChannel();

            this.connection = conn;
            this.channel = ch;

            await ch.assertQueue(REQ_QUEUE, { durable: true });
            await ch.assertQueue(RES_QUEUE, { durable: true });

            rabbitMQLogger.info("Connected to RabbitMQ successfully");

            this.startListening(io);
        } catch (error) {
            rabbitMQLogger.error({ error }, "Failed to connect to RabbitMQ");
        }
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

        ch.consume(RES_QUEUE, (msg) => {
            if (msg !== null) {
                try {
                    const response: CreateSessionResponse = JSON.parse(msg.content.toString());

                    rabbitMQLogger.info(
                        { collaborationId: response.session.collaborationId },
                        "Received room ready confirmation from Collab",
                    );

                    const collaborationPayload: CollaborationSuccessPayload = {
                        matchFound: true,
                        ...(response.session.matchId && { matchId: response.session.matchId }),
                        collaborationId: response.session.collaborationId,
                        matchedTopic: response.session.topic,
                        matchedDifficulty: response.session.difficulty,
                        matchedLanguage: response.session.language,
                        userId: response.session.userAId,
                        partnerId: response.session.userBId,
                    };

                    io.to(response.session.userAId).emit("match_success", collaborationPayload);
                    io.to(response.session.userBId).emit("match_success", collaborationPayload);

                    ch.ack(msg);
                } catch (error) {
                    rabbitMQLogger.error({ error }, "Failed to process Collab response");
                    ch.nack(msg, false, true);
                }
            }
        });
    }
}
