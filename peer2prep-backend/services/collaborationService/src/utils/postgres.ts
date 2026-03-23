import { Pool, QueryResult, QueryResultRow } from "pg";

import { env } from "@/config/env.js";
import { logger } from "@/utils/logger.js";

let pool: Pool | null = null;

export function getPostgresPool(): Pool {
    if (!pool) {
        pool = new Pool({
            connectionString: env.databaseUri,
        });

        pool.on("error", (error) => {
            logger.error({ err: error }, "Unexpected PostgreSQL pool error");
        });
    }

    return pool;
}

export async function initializePostgres(): Promise<void> {
    const db = getPostgresPool();
    await db.query("SELECT 1");

    const requiredTables = ["collaboration_sessions"];
    const result = await db.query<{ table_name: string }>(
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
        throw new Error(
            `Database schema is not initialized. Missing tables: ${missingTables.join(", ")}. Run 'npm run db:migrate'.`,
        );
    }

    logger.info("PostgreSQL connection verified");
}

export async function query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
): Promise<QueryResult<T>> {
    const db = getPostgresPool();
    return db.query<T>(text, params);
}

export async function closePostgres(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
        logger.info("PostgreSQL connection closed");
    }
}
