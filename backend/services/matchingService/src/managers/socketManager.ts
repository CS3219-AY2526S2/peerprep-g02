import { Server, Socket } from "socket.io";

import { attemptRejoin, cancelMatch, findMatch, handleDisconnect } from "@/match/match.js";
import { MatchDetailsSchema, type MatchRequest } from "@/types/match.js";
import { socketLogger } from "@/utils/logger.js";

const socketWrapper = (
    io: Server,
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
            io.to(userId).emit("match_error", {
                message: "An unexpected error occurred. Please try again.",
            });
        }
    };
};

export const registerSocketHandlers = (io: Server) => {
    io.on("connection", async (socket: Socket) => {
        const userId = socket.data.userId;

        if (!userId) {
            socketLogger.error("Socket connected without a verified userId. Disconnecting.");
            socket.disconnect(true);
            return;
        }

        socket.join(userId);
        socketLogger.info(`User ${userId} connected with socket ID ${socket.id}`);

        try {
            const rejoinResult = await attemptRejoin(userId);
            if (rejoinResult.success) {
                socketLogger.info(`Syncing new tab for user ${userId} to active queue.`);
                socket.emit("match_waiting", {
                    message: "You are already in the queue. Resuming search...",
                    startTime: rejoinResult.startTime,
                });
            }
        } catch (error) {
            socketLogger.error(error, `Error during connection sync for user ${userId}`);
        }

        socket.on(
            "join_queue",
            socketWrapper(io, socket, "join_queue", async (req: any) => {
                const matchDetails = MatchDetailsSchema.safeParse(req);

                if (!matchDetails.success) {
                    socketLogger.warn(
                        `Invalid join_queue request from user ${userId}: ${matchDetails.error}`,
                    );
                    io.to(userId).emit("match_error", { message: "Invalid request format" });
                    return;
                }

                if (!matchDetails.data.isUpdate) {
                    const rejoinResult = await attemptRejoin(userId);
                    if (rejoinResult.success) {
                        socketLogger.info(`User ${userId} resumed queuing`);
                        socket.emit("match_waiting", {
                            message: "Resumed search, waiting for a match...",
                            startTime: rejoinResult.startTime,
                        });
                        return;
                    }
                }

                socketLogger.info(`User ${userId} finding match`);
                const matchRequest: MatchRequest = {
                    ...matchDetails.data,
                    userId,
                };

                const matchResult = await findMatch(matchRequest);

                if (matchResult.matchFound) {
                    socketLogger.info(
                        `Match Found: ${userId} & ${matchResult.partnerId} on ${matchResult.matchedTopic} (${matchResult.matchedDifficulty}, ${matchResult.matchedLanguage})`,
                    );
                    const sharedData = {
                        matchFound: matchResult.matchFound,
                        matchId: matchResult.matchId,
                        matchedTopic: matchResult.matchedTopic,
                        matchedDifficulty: matchResult.matchedDifficulty,
                        matchedLanguage: matchResult.matchedLanguage,
                    };
                    io.to(userId).emit("match_preparing", {
                        ...sharedData,
                        userId,
                        partnerId: matchResult.partnerId,
                    });
                    io.to(matchResult.partnerId).emit("match_preparing", {
                        ...sharedData,
                        userId: matchResult.partnerId,
                        partnerId: userId,
                    });
                } else {
                    socketLogger.info(
                        `User ${userId} added to queue for ${matchRequest.topics.join(", ")} for ${matchRequest.difficulties.join(", ")} in ${matchRequest.languages.join(", ")}.`,
                    );
                    io.to(userId).emit("match_waiting", {
                        message: "Added to queue, waiting for a match...",
                        startTime: matchResult.startTime,
                    });
                }
            }),
        );

        socket.on(
            "cancel_queue",
            socketWrapper(io, socket, "cancel_queue", async () => {
                const isCancelled = await cancelMatch(userId);
                if (isCancelled) {
                    socketLogger.info(`User ${userId} cancelled matchmaking.`);
                    io.to(userId).emit("match_cancelled", { message: "You have left the queue." });
                } else {
                    socketLogger.warn(`Failed to cancel matchmaking for user ${userId}.`);
                    io.to(userId).emit("match_error", {
                        message: "Failed to leave the queue. Please try again.",
                    });
                }
            }),
        );

        socket.on(
            "disconnect",
            socketWrapper(io, socket, "disconnect", async () => {
                const sockets = await io.in(userId).fetchSockets();
                if (sockets.length === 0) {
                    socketLogger.info(`User ${userId} disconnected.`);
                    await handleDisconnect(userId);
                }
            }),
        );
    });
};
