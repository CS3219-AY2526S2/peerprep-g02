import { HTTP_STATUS } from "@/config/constants.js";

export class AppError extends Error {
    constructor(
        public readonly code: string,
        public readonly statusCode: number,
        message: string,
        public readonly details?: Record<string, unknown>,
    ) {
        super(message);
        this.name = "AppError";
    }
}

export function toAppError(error: unknown): AppError {
    if (error instanceof AppError) {
        return error;
    }

    if (error instanceof Error) {
        return new AppError("UNEXPECTED_ERROR", HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message);
    }

    return new AppError(
        "UNEXPECTED_ERROR",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "An unexpected error occurred.",
    );
}
