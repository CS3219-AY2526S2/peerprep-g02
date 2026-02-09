import mongoose from "mongoose";
import { createServer } from "http";
import { AppConstants } from "@/constants";
import { initializeSocket } from "@/socket/socket";
import app from "@/app";

const port = AppConstants.PORT;

// Connect to MongoDB
mongoose
    .connect(AppConstants.DATABASE_URI)
    .then(async () => {
        console.log("MongoDB Connected");
    })
    .catch((err) => console.error("MongoDB Connection Error:", err));

mongoose.connection.on("disconnected", () => console.log("MongoDB Disconnected!"));

// Create and start HTTP server
const server = createServer(app);
initializeSocket(server);

server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on ${AppConstants.API_BASE_URI}:${port}`);
});