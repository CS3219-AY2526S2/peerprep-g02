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
    host: process.env.DB_HOST || "cloudsql-proxy",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "Arcanum123!",
    database: process.env.DB_NAME || "postgres",
});


pool.connect()
  .then(() => console.log('Connected to Cloud SQL'))
  .catch((err: any) => console.error('DB connection error:', err));

export default pool;
