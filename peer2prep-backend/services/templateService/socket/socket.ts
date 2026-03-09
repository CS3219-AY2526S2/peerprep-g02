import { Server } from "socket.io";
import { Server as HTTPServer } from "http";
import { SocketConstants } from "@/constants";


export const initializeSocket = (httpServer: HTTPServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_ORIGIN,
    },
        pingTimeout: SocketConstants.PING_TIMEOUT,
        pingInterval: SocketConstants.PING_INTERVAL,
  });

  io.on("connection", (socket) => {
    console.log("🔌 Client connected:", socket.id);

    socket.on("ping", () => {
      socket.emit("pong");
    });

    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);
    });
  });

  return io;
};
