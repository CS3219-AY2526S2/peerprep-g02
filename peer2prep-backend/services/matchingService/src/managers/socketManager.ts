import { findMatch } from "@/match/match.js";
import { Server } from "socket.io";

export const registerSocketHandlers = (io: Server) => {
    io.on("connection", (socket) => {
        console.log(`User connected: ${socket.id}`);

        socket.on("join_queue", () => findMatch(socket.id));

        socket.on("disconnect", () => {
            console.log(`User disconnected: ${socket.id}`);
        });
    });
};
