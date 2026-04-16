import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

// const pool = new Pool({
//     host: process.env.DB_HOST || "localhost",
//     port: Number(process.env.DB_PORT) || 5432,
//     user: process.env.DB_USER || "postgres",
//     password: process.env.DB_PASSWORD || "postgres",
//     database: process.env.DB_NAME || "questions",
// });

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

pool.connect()
    .then(() => console.log("Connected to Cloud SQL"))
    .catch((err: any) => console.error("DB connection error:", err));

export default pool;
