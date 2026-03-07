import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { AppConstants } from "../constants.js";

type AppliedMigrationRow = {
    version: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDirectory = path.resolve(__dirname, "../migrations");

async function runMigrations(): Promise<void> {
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
