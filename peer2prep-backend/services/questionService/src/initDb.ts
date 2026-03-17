import { readFile } from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config();

const sqlFilePath = path.resolve(process.cwd(), "QUDB.sql");

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = Number(process.env.DB_PORT) || 5432;
const DB_USER = process.env.DB_USER || "postgres";
const DB_PASSWORD = process.env.DB_PASSWORD || "postgres";
const TARGET_DB = "peerprep_question";

function quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
}

async function ensureDatabaseExists(): Promise<void> {
    const maintenanceClient = new Client({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: "postgres",
    });

    await maintenanceClient.connect();
    try {
        const existsResult = await maintenanceClient.query(
            "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
            [TARGET_DB],
        );

        if ((existsResult.rows[0] as { exists?: boolean } | undefined)?.exists) {
            return;
        }

        await maintenanceClient.query(`CREATE DATABASE ${quoteIdentifier(TARGET_DB)}`);
        console.log(`Created database '${TARGET_DB}'.`);
    } finally {
        await maintenanceClient.end();
    }
}

async function initializeSchema(): Promise<void> {
    const client = new Client({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: TARGET_DB,
    });

    await client.connect();
    try {
        const tableResult = await client.query("SELECT to_regclass('public.questions') AS table_name");

        if ((tableResult.rows[0] as { table_name?: string | null } | undefined)?.table_name) {
            console.log("Question schema already exists. Skipping QUDB.sql import.");
            return;
        }

        const sql = await readFile(sqlFilePath, "utf8");
        await client.query(sql);
        console.log(`Imported '${path.basename(sqlFilePath)}' into '${TARGET_DB}'.`);
    } finally {
        await client.end();
    }
}

async function main(): Promise<void> {
    await ensureDatabaseExists();
    await initializeSchema();
}

main().catch((error) => {
    console.error("Question database initialization failed:", error);
    process.exit(1);
});
