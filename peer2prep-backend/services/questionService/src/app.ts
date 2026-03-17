import express from "express";
import questionRoute from "./routes/routes";
import cors from 'cors';

const app = express();
const port = 3005;



// Allow requests from your frontend
app.use(cors({
origin: ["http://localhost:3000", "http://localhost:5173", "http://localhost:3005"], // React dev server
methods: ['GET','POST','PUT','DELETE'],
credentials: true, // if you use cookies/auth
}));
app.use(express.json());
app.use("/v1/api", questionRoute);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});