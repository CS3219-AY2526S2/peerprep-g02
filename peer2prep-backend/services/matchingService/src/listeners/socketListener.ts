import { Server } from "socket.io"

export const registerSocketHandlers = (io: Server) => {
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}`);

        socket.on("join_queue", (data) => {
            console.log(`Player ${socket.id} joined the queue with data:`, data);
            socket.emit("status", `Welcome! Your ID (${socket.id}) is now in the queue.`);
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
        });
    });
};