import app from "@/app.js";
import { createServer } from "http";
import { Server } from "socket.io";
import { registerSocketHandlers } from "./listeners/socketListener.js";

const PORT = 5000;
const server = createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
    }
});

registerSocketHandlers(io);

server.listen(PORT, () => {
    console.log(`Matching Service live at http://localhost:${PORT}`);
});
