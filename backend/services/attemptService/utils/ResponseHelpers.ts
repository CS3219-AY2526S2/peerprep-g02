import type { Response } from "express";

import { logger } from "@/utils/logger.js";

type ErrorWithStatus = Error & {
    statusCode?: number;
};

export class ServiceError extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
        super(message);
        this.statusCode = statusCode;
        this.name = "ServiceError";
    }
}

export function handleError(res: Response, error: unknown, action: string): void {
    logger.error({ err: error }, `Error during ${action}`);

    if (error instanceof Error) {
        const statusCode =
            typeof (error as ErrorWithStatus).statusCode === "number"
                ? (error as ErrorWithStatus).statusCode
                : 500;
        res.status(statusCode ?? 500).json({ error: error.message });
        return;
    }

    res.status(500).json({ error: `Unknown error occurred during ${action}.` });
}

export function badRequest(res: Response, message: string): void {
    res.status(400).json({ error: message });
}
