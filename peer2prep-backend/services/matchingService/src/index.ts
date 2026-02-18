import app from "@/app.js";
import { createServer } from "http";
import { Server } from "socket.io";
import { registerSocketHandlers } from "./managers/socketManager.js";
import RedisManager from "./managers/redisManager.js";

const PORT = 5000;
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const startServer = async () => {
    try {
        await RedisManager.connect();
        registerSocketHandlers(io);

        server.listen(PORT, () => {
            console.log(`Matching Service live at http://localhost:${PORT}`);
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
