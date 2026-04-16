import { env } from "@/config/env.js";
import { REQUIRED_RUNTIMES } from "@/config/constants.js";
import { logger } from "@/utils/logger.js";

type PistonRuntime = {
    language: string;
    version: string;
    aliases: string[];
};

async function getInstalledRuntimes(): Promise<PistonRuntime[]> {
    const response = await fetch(`${env.pistonUrl}/api/v2/runtimes`);
    if (!response.ok) {
        throw new Error(`Failed to fetch runtimes: ${response.status}`);
    }
    return (await response.json()) as PistonRuntime[];
}

function isRuntimeInstalled(installed: PistonRuntime[], language: string): boolean {
    return installed.some(
        (rt) => rt.language === language || rt.aliases.includes(language),
    );
}

/**
 * Fire-and-forget: sends one install request per missing runtime.
 * Piston package installs can take several minutes (especially under
 * Rosetta on Apple Silicon). We do NOT retry or re-request — a single
 * POST is enough; Piston queues the work internally.
 */
async function installRuntime(language: string, version: string): Promise<void> {
    logger.info({ language, version }, "Requesting Piston runtime install (fire-and-forget)");

    // Use a very long timeout — Piston downloads + compiles the runtime.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minutes

    try {
        const response = await fetch(`${env.pistonUrl}/api/v2/packages`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ language, version }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const text = await response.text().catch(() => "Unknown error");
            logger.warn({ language, version, text }, "Runtime install request returned error");
        } else {
            logger.info({ language, version }, "Runtime installed successfully");
        }
    } catch (error) {
        // AbortError on timeout, or network error — log and move on.
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn({ language, version, error: msg }, "Runtime install request failed (will retry on next startup)");
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Ensures all required runtimes are installed on the Piston instance.
 * Waits for Piston API to become reachable, then fires install requests
 * for any missing runtimes. Each install runs concurrently and is
 * fire-and-forget — we don't block server startup.
 */
export async function ensurePistonRuntimes(): Promise<void> {
    // Wait for Piston API to be reachable
    for (let attempt = 1; attempt <= 15; attempt++) {
        try {
            const installed = await getInstalledRuntimes();
            logger.info(
                { count: installed.length, runtimes: installed.map((r) => `${r.language}@${r.version}`) },
                "Piston runtimes currently installed",
            );

            const missing = REQUIRED_RUNTIMES.filter(
                (req) => !isRuntimeInstalled(installed, req.language),
            );

            if (missing.length === 0) {
                logger.info("All required Piston runtimes are ready");
                return;
            }

            // Fire install requests concurrently — don't await sequentially.
            // Each one can take minutes; they'll log their own success/failure.
            for (const req of missing) {
                installRuntime(req.language, req.version);
            }

            return;
        } catch {
            logger.warn({ attempt, maxRetries: 15 }, "Piston not reachable yet, retrying...");
            await new Promise((resolve) => setTimeout(resolve, 3000));
        }
    }

    logger.error("Could not reach Piston after 15 attempts — runtimes will not be auto-installed");
}
