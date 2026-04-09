function readNumber(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
    port: readNumber(process.env.PORT, 3006),
    internalServiceApiKey: process.env.INTERNAL_SERVICE_API_KEY ?? "",
    pistonUrl: process.env.PISTON_URL ?? "http://piston:2000",
    runTimeout: readNumber(process.env.PISTON_RUN_TIMEOUT, 10_000),
    runMemoryLimit: readNumber(process.env.PISTON_RUN_MEMORY_LIMIT, 128 * 1024 * 1024),
    logLevel: process.env.LOG_LEVEL ?? "info",
    rabbitmqUrl: process.env.RABBITMQ_URL ?? "amqp://localhost:5672",
};
