import { Response } from "express";
import { logger } from "./logger.js";

type ErrorWithStatus = Error & {
    statusCode?: number;
};

type ClerkApiErrorItem = {
    code?: string;
    message?: string;
    longMessage?: string;
};

type ClerkApiResponseError = Error & {
    clerkError?: boolean;
    status?: number;
    errors?: ClerkApiErrorItem[];
};

export class ServiceError extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
        super(message);
        this.statusCode = statusCode;
        this.name = "ServiceError";
    }
}

// handles authService errors
export function toServiceError(
    error: unknown,
    fallbackMessage: string,
    fallbackStatus = 500,
): ServiceError {
    if (error instanceof ServiceError) {
        return error;
    }

    const clerkError = error as ClerkApiResponseError;
    if (clerkError?.clerkError && typeof clerkError.status === "number") {
        const firstError = clerkError.errors?.[0];
        const message = firstError?.longMessage || firstError?.message || clerkError.message;
        return new ServiceError(clerkError.status, message || fallbackMessage);
    }

    return new ServiceError(
        fallbackStatus,
        error instanceof Error ? error.message : fallbackMessage,
    );
}

// handles errors in controllers
export function handleError(res: Response, error: unknown, action: string): void {
    logger.error({ err: error }, `Error during ${action}`);

    if (error instanceof Error) {
        const statusCode =
            typeof (error as ErrorWithStatus).statusCode === "number"
                ? (error as ErrorWithStatus).statusCode!
                : 500;
        res.status(statusCode).json({ error: error.message });
        return;
    }

    res.status(500).json({ error: `Unknown error occurred during ${action}.` });
}

export function badRequest(res: Response, message: string): void {
    res.status(401).json({ error: message });
}
