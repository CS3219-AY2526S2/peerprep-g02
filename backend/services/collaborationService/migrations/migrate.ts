import "dotenv/config";

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client, Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDirectory = __dirname;

const DATABASE_URI =
    process.env.CS_DATABASE_URI ?? "postgresql://localhost:5432/collaboration_service";

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
    const databaseName = parseDatabaseName(DATABASE_URI);
    if (databaseName === "postgres") {
        return;
    }

    const maintenanceClient = new Client({
        connectionString: toMaintenanceConnectionString(DATABASE_URI),
    });

    await maintenanceClient.connect();
    try {
        const existsResult = await maintenanceClient.query<{ exists: boolean }>(
            "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
            [databaseName],
        );

        if (existsResult.rows[0]?.exists) {
            console.log(`Database '${databaseName}' already exists`);
            return;
        }

        await maintenanceClient.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
        console.log(`Created database '${databaseName}'`);
    } finally {
        await maintenanceClient.end();
    }
}

async function runMigrations(): Promise<void> {
    await ensureDatabaseExists();

    const pool = new Pool({
        connectionString: DATABASE_URI,
    });

    const client = await pool.connect();
    try {
        // Create migrations tracking table if not exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS _migrations (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        // Get already applied migrations
        const appliedResult = await client.query<{ name: string }>(
            "SELECT name FROM _migrations ORDER BY id",
        );
        const appliedMigrations = new Set(appliedResult.rows.map((row) => row.name));

        // Get pending migration files
        const migrationFiles = (await readdir(migrationsDirectory))
            .filter((fileName) => fileName.endsWith(".sql"))
            .sort((left, right) => left.localeCompare(right));

        let appliedCount = 0;
        for (const fileName of migrationFiles) {
            if (appliedMigrations.has(fileName)) {
                console.log(`Skipping already applied migration: ${fileName}`);
                continue;
            }

            const filePath = path.join(migrationsDirectory, fileName);
            const sql = await readFile(filePath, "utf8");

            await client.query("BEGIN");
            try {
                await client.query(sql);
                await client.query("INSERT INTO _migrations (name) VALUES ($1)", [fileName]);
                await client.query("COMMIT");
                console.log(`Applied migration: ${fileName}`);
                appliedCount++;
            } catch (error) {
                await client.query("ROLLBACK");
                console.error(`Failed to apply migration: ${fileName}`);
                throw error;
            }
        }

        if (appliedCount === 0) {
            console.log("No new migrations to apply");
        } else {
            console.log(`Applied ${appliedCount} migration(s) successfully`);
        }
    } finally {
        client.release();
        await pool.end();
    }
}

runMigrations().catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
});
