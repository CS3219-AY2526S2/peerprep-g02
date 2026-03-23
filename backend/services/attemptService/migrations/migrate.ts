import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client, Pool } from "pg";

import { AppConstants } from "../constants.js";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDirectory = path.resolve(__dirname, "../migrations");
const migrationLogger = logger.child({ scope: "migrations" });

function parseDatabaseName(connectionString: string): string {
    const parsed = new URL(connectionString);
    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));

    if (!databaseName) {
        throw new Error("DATABASE_URI must include a database name in the path.");
    }

    return databaseName;
}

function toMaintenanceConnectionString(connectionString: string): string {
    const parsed = new URL(connectionString);
    parsed.pathname = "/postgres";
    return parsed.toString();
}

function quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
}

async function ensureDatabaseExists(): Promise<void> {
    const databaseName = parseDatabaseName(AppConstants.DATABASE_URI);
    if (databaseName === "postgres") {
        return;
    }

    const maintenanceClient = new Client({
        connectionString: toMaintenanceConnectionString(AppConstants.DATABASE_URI),
    });

    await maintenanceClient.connect();
    try {
        const existsResult = await maintenanceClient.query<{ exists: boolean }>(
            "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
            [databaseName],
        );

        if (existsResult.rows[0]?.exists) {
            return;
        }

        await maintenanceClient.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
        migrationLogger.info({ databaseName }, "Created PostgreSQL database");
    } finally {
        await maintenanceClient.end();
    }
}

async function runMigrations(): Promise<void> {
    await ensureDatabaseExists();

    const pool = new Pool({
        connectionString: AppConstants.DATABASE_URI,
    });

    const client = await pool.connect();
    try {
        const migrationFiles = (await readdir(migrationsDirectory))
            .filter((fileName) => fileName.endsWith(".sql"))
            .sort((left, right) => left.localeCompare(right));

        for (const fileName of migrationFiles) {
            const filePath = path.join(migrationsDirectory, fileName);
            const sql = await readFile(filePath, "utf8");

            await client.query("BEGIN");
            try {
                await client.query(sql);
                await client.query("COMMIT");
                migrationLogger.info({ fileName }, "Applied migration");
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            }
        }

        migrationLogger.info("Migrations completed successfully");
    } finally {
        client.release();
        await pool.end();
    }
}

runMigrations().catch((error) => {
    migrationLogger.error({ err: error }, "Migration failed");
    process.exit(1);
});
