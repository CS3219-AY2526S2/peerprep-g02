import cors from "cors";
import express from "express";

import internalRoute from "./routes/internalRoutes";
import questionRoute from "./routes/routes";

const app = express();
const port = 3005;

// Allow requests from your frontend
app.use(
    cors({
        origin: ["http://localhost:3001", "http://localhost:5173", "http://localhost:3005"], // React dev server
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true, // if you use cookies/auth
    }),
);
app.use(express.json());
// Internal routes must be mounted BEFORE question routes
// to avoid requireAdminAuth middleware blocking internal service calls
app.use("/internal", internalRoute);
app.use("/", questionRoute);

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
