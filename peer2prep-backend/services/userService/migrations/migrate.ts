import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client, Pool } from "pg";
import { AppConstants } from "../constants.js";

type AppliedMigrationRow = {
    version: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDirectory = path.resolve(__dirname, "../migrations");

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
    return `"${identifier.replace(/"/g, "\"\"")}"`;
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
        console.log(`Created database '${databaseName}'.`);
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
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        const migrationFiles = (await readdir(migrationsDirectory))
            .filter((fileName) => fileName.endsWith(".sql"))
            .sort((left, right) => left.localeCompare(right));

        const appliedResult = await client.query<AppliedMigrationRow>(
            "SELECT version FROM schema_migrations",
        );
        const appliedVersions = new Set(appliedResult.rows.map((row) => row.version));

        for (const fileName of migrationFiles) {
            if (appliedVersions.has(fileName)) {
                continue;
            }

            const filePath = path.join(migrationsDirectory, fileName);
            const sql = await readFile(filePath, "utf8");

            await client.query("BEGIN");
            try {
                await client.query(sql);
                await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [fileName]);
                await client.query("COMMIT");
                console.log("Applied migration.");
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            }
        }

        console.log("Migrations completed successfully.");
    } finally {
        client.release();
        await pool.end();
    }
}

runMigrations().catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
});
