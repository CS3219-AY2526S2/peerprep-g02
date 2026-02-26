import { Server, Socket } from "socket.io";
import { findMatch } from "@/match/match.js";
import { socketLogger } from "@/utils/logger.js";
import { type MatchRequest } from "@/types/match.js";

export const registerSocketHandlers = (io: Server) => {
    io.on("connection", (socket: Socket) => {
        socket.on("join_queue", async (req: MatchRequest) => {
            try {
                if (!req || !req.userId) {
                    socket.emit("match_error", { message: "Invalid request" });
                    return;
                }
                
                socket.data.userId = req.userId;
                socket.join(req.userId);

                const result = await findMatch(req);

                if (result.matchFound) {
                    const payload = {
                        matchId: result.matchId,
                        matchedTopic: req.topic,
                        matchedDifficulty: req.difficulty,
                        matchedLanguage: result.matchedLanguage,
                        users: [req.userId, result.partnerId],
                    };

                    io.to(req.userId).emit("match_success", payload);
                    io.to(result.partnerId).emit("match_success", payload);
                } else {
                    io.to(req.userId).emit("waiting_for_match", {
                        message: "Waiting for partner...",
                    });
                }
            } catch (err) {
                socketLogger.error(err, "Error in join_queue");
                socket.emit("match_error", { message: "Internal server error" });
            }
        });
    });
};
