import app from "@/app.js";
import { createServer } from "http";
import { Server } from "socket.io";
import { registerSocketHandlers } from "./managers/socketManager.js";
import RedisManager from "./managers/redisManager.js";
import 'dotenv/config';

const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const startServer = async () => {
    try {
        await RedisManager.connect();
        registerSocketHandlers(io);

        server.listen(process.env.MS_SERVER_PORT, () => {
            console.log(`Matching Service live at http://localhost:${process.env.MS_SERVER_PORT}`);
        });
    } catch (error) {
        console.error("Failed to start Matching Service:", error);
        process.exit(1);
    }
};

process.on("SIGINT", async () => {
    console.log("Shutting down...");
    await RedisManager.disconnect();
    process.exit(0);
});

startServer();
