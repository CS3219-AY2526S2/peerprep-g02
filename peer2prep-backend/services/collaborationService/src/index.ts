import "dotenv/config";

import { createServer } from "node:http";
import { Server } from "socket.io";

import app from "@/app.js";
import { env } from "@/config/env.js";
import { socketAuthMiddleware } from "@/middleware/socketAuth.js";
import { registerSocketHandlers } from "@/sockets/registerSocketHandlers.js";
import { logger } from "@/utils/logger.js";

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: env.frontendUrl,
        credentials: true,
    },
});

io.use(socketAuthMiddleware);
registerSocketHandlers(io);

server.listen(env.port, "0.0.0.0", () => {
    logger.info(`Collaboration Service live at http://localhost:${env.port}`);
});
