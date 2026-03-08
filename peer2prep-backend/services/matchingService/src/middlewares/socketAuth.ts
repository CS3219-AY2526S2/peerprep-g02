import { Socket } from "socket.io";

// stub for now
export const socketAuthMiddleware = (socket: Socket, next: (err?: Error) => void) => {
    const userId = socket.handshake.auth?.userId || socket.handshake.headers?.['x-user-id'];

    if (!userId) {
        console.error("Connection rejected: No userId provided in stub mode.");
        return next(new Error("Authentication failed: userId required"));
    }

    socket.data.userId = userId;    
    next();
};