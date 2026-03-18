import { Server, Socket } from "socket.io";

import { attemptRejoin, cancelMatch, findMatch, handleDisconnect } from "@/match/match.js";
import { collaborationGatewayClient } from "@/services/collaborationGatewayClient.js";
import { MatchDetailsSchema, type MatchRequest } from "@/types/match.js";
import { socketLogger } from "@/utils/logger.js";

const socketWrapper = (
    socket: Socket,
    handlerName: string,
    handler: (...args: any[]) => Promise<void>,
) => {
    return async (...args: any[]) => {
        try {
            await handler(...args);
        } catch (error) {
            const userId = socket.data.userId || "unknown";
            socketLogger.error(error, `Error in ${handlerName} for user ${userId}`);
            socket.emit("match_error", {
                message: "An unexpected error occurred. Please try again.",
            });
        }
    };
};

export const registerSocketHandlers = (io: Server) => {
    io.on("connection", (socket: Socket) => {
        const userId = socket.data.userId;

        if (!userId) {
            socketLogger.error("Socket connected without a verified userId. Disconnecting.");
            socket.disconnect(true);
            return;
        }

        socket.join(userId);
        socketLogger.info(`User ${userId} connected with socket ID ${socket.id}`);

        socket.on(
            "join_queue",
            socketWrapper(socket, "join_queue", async (req: any) => {
                const matchDetails = MatchDetailsSchema.safeParse(req);

                if (!matchDetails.success) {
                    socketLogger.warn(
                        `Invalid join_queue request from user ${userId}: ${matchDetails.error}`,
                    );
                    socket.emit("match_error", { message: "Invalid request format" });
                    return;
                }

                const isSuccessfulRejoin = await attemptRejoin(userId);
                if (isSuccessfulRejoin) {
                    socketLogger.info(`User ${userId} resumed queuing`);
                    socket.emit("match_waiting", {
                        message: "Resumed search, waiting for a match...",
                    });
                    return;
                }

                socketLogger.info(`User ${userId} finding match`);
                const matchRequest: MatchRequest = {
                    ...matchDetails.data,
                    userId,
                };

                const matchResult = await findMatch(matchRequest);

                if (matchResult.matchFound) {
                    try {
                        const collaborationSessionId =
                            await collaborationGatewayClient.createSession({
                                matchId: matchResult.matchId,
                                userAId: matchResult.userId,
                                userBId: matchResult.partnerId,
                                difficulty: matchResult.matchedDifficulty,
                                language: matchResult.matchedLanguage,
                                topic: matchResult.matchedTopic,
                            });

                        const matchPayload = {
                            ...matchResult,
                            collaborationSessionId,
                        };

                        socketLogger.info(
                            {
                                userId,
                                partnerId: matchResult.partnerId,
                                collaborationSessionId,
                            },
                            "Match found and collaboration session created",
                        );
                        io.to(userId).emit("match_success", matchPayload);
                        io.to(matchResult.partnerId).emit("match_success", matchPayload);
                    } catch (error) {
                        socketLogger.error(
                            error,
                            `Failed to create collaboration session for ${userId} and ${matchResult.partnerId}`,
                        );
                        io.to(userId).emit("match_error", {
                            message:
                                "Match found, but collaboration session setup failed. Please try again.",
                        });
                        io.to(matchResult.partnerId).emit("match_error", {
                            message:
                                "Match found, but collaboration session setup failed. Please try again.",
                        });
                    }
                } else {
                    socketLogger.info(`User ${userId} added to queue for ${matchRequest.topic}.`);
                    socket.emit("match_waiting", {
                        message: "Added to queue, waiting for a match...",
                    });
                }
            }),
        );

        socket.on(
            "cancel_queue",
            socketWrapper(socket, "cancel_queue", async () => {
                const isCancelled = await cancelMatch(userId);
                if (isCancelled) {
                    socketLogger.info(`User ${userId} cancelled matchmaking.`);
                    socket.emit("match_cancelled", { message: "You have left the queue." });
                } else {
                    socketLogger.warn(`Failed to cancel matchmaking for user ${userId}.`);
                    socket.emit("match_error", {
                        message: "Failed to leave the queue. Please try again.",
                    });
                }
            }),
        );

        socket.on(
            "disconnect",
            socketWrapper(socket, "disconnect", async () => {
                const sockets = await io.in(userId).fetchSockets();
                if (sockets.length === 0) {
                    socketLogger.info(`User ${userId} disconnected.`);
                    await handleDisconnect(userId);
                }
            }),
        );
    });
};
