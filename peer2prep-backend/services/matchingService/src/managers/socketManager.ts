import { Server, Socket } from "socket.io";
import { 
    attemptRejoin,
    cancelMatch,
    findMatch,
    handleDisconnect,
} from "@/match/match.js";
import { MatchDetailsSchema, type MatchRequest } from "@/types/match.js";
import { socketLogger } from "@/utils/logger.js";

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

        socket.on("join_queue", async (req: any) => {
            const matchDetails = MatchDetailsSchema.safeParse(req);

            if (!matchDetails.success) {
                socketLogger.error(`Invalid join_queue request from user ${userId}: ${matchDetails.error}`);
                socket.emit("match_error", { message: "Invalid request format" });
                return;
            }

            const isSuccessfulRejoin = await attemptRejoin(userId);

            if (isSuccessfulRejoin) {
                socketLogger.info(`User ${userId} resumed queuing`);
                socket.emit("match_waiting", { message: "Resumed search, waiting for a match..." });
                return;
            } 

            socketLogger.info(`User ${userId} finding match`)
            const matchRequest: MatchRequest = {
                ...matchDetails.data,
                userId,
            };

            const matchResult = await findMatch(matchRequest);

            if (matchResult.matchFound) {
                socketLogger.info(`Match Found: ${userId} & ${matchResult.partnerId}`);
                io.to(userId).emit("match_success", matchResult);
                io.to(matchResult.partnerId).emit("match_success", matchResult);
            } else {
                socketLogger.info(`User ${userId} added to queue for ${matchRequest.topic}.`);
                socket.emit("match_waiting", { message: "Added to queue, waiting for a match..." });
            }
        });

        socket.on("cancel_queue", async () => {
            const isCancelled = await cancelMatch(userId);
            if (isCancelled) {
                socketLogger.info(`User ${userId} cancelled matchmaking.`);
                socket.emit("match_cancelled", { message: "You have left the queue." });
            } else {
                socketLogger.error(`Failed to cancel matchmaking for user ${userId}.`);
                socket.emit("match_error", { message: "Failed to leave the queue. Please try again." });
            }
        });

        socket.on("disconnect", async () => {
            // only the last disconnect matters, e.g. if multiple tabs are open
            const sockets = await io.in(userId).fetchSockets();
            if (sockets.length == 0) {
                socketLogger.info(`User ${userId} disconnected.`);
                await handleDisconnect(userId);
            }
        });
    });
};