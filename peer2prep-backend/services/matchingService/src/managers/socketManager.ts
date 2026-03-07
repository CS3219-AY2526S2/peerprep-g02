import { Server } from "socket.io";

import { findMatch } from "@/match/match.js";
import { socketLogger } from "@/utils/logger.js";

export const registerSocketHandlers = (io: Server) => {
    io.on("connection", (socket) => {
        socketLogger.info(`User connected: ${socket.id}`);

        socket.on("join_queue", () => findMatch(socket.id));

        socket.on("disconnect", () => {
            socketLogger.info(`User disconnected: ${socket.id}`);
        });
    });
};
