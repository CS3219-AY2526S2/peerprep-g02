import { Pool, type QueryResult, type QueryResultRow } from "pg";

import { logger } from "@/utils/logger.js";

const connectionString = process.env.CS_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("CS_DATABASE_URL or DATABASE_URL must be configured for collaboration service.");
}

const pool = new Pool({
    connectionString,
});

pool.on("error", (error: Error) => {
    logger.error({ err: error }, "Unexpected PostgreSQL pool error");
});

export async function initializePostgres(): Promise<void> {
    await pool.query("SELECT 1");
}

export async function query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
): Promise<QueryResult<T>> {
    return pool.query<T>(text, params);
}

export async function closePostgres(): Promise<void> {
    await pool.end();
}
