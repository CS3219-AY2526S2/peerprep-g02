import { Pool, QueryResult, QueryResultRow } from "pg";

import { AppConstants } from "../constants.js";
import { logger } from "./logger.js";

const pool = new Pool({
    connectionString: AppConstants.DATABASE_URI,
});

pool.on("error", (error) => {
    logger.error({ err: error }, "Unexpected PostgreSQL pool error");
});

export async function initializePostgres(): Promise<void> {
    await pool.query("SELECT 1");
    const requiredTables = ["users", "admin_audit_logs"];
    const result = await pool.query<{ table_name: string }>(
        `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = ANY($1::text[])
        `,
        [requiredTables],
    );

    const existingTables = new Set(result.rows.map((row) => row.table_name));
    const missingTables = requiredTables.filter((table) => !existingTables.has(table));

    if (missingTables.length > 0) {
        throw new Error("Database schema is not initialized. Run 'npm run db:migrate'.");
    }
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
