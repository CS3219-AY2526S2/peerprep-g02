import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client, Pool } from "pg";
import { AppConstants } from "../constants.js";

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
        console.log(`Created database '${databaseName}'.`);
    } finally {
        await maintenanceClient.end();
    }
}

async function runMigrations(): Promise<void> {
    const superUserId = AppConstants.CLERK_SUPERUSER_ID?.trim();
    if (!superUserId) {
        throw new Error("CLERK_SUPERUSER_ID is required to run migrations.");
    }

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
                console.log(`Applied migration: ${fileName}`);
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            }
        }

        const superUserCountResult = await client.query<{ count: string }>(
            `
                SELECT COUNT(*)::text AS count
                FROM users
                WHERE role = 'super_user'
            `,
        );
        let superUserCount = Number(superUserCountResult.rows[0]?.count ?? "0");

        if (superUserCount === 0) {
            await client.query(
                `
                    INSERT INTO users (clerk_user_id, name, status, role)
                    VALUES ($1, 'Super User', 'active', 'super_user')
                `,
                [superUserId],
            );
            console.log("Injected initial super user record.");
            superUserCount = 1;
        }

        if (superUserCount !== 1) {
            throw new Error("Database invariant violation: expected exactly 1 super_user row.");
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
