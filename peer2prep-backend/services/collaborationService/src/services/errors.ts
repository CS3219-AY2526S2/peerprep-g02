import { CreateSessionErrorCode } from "@/models/models.js";

export class SessionCreationError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly code: CreateSessionErrorCode,
        message: string,
    ) {
        super(message);
        this.name = "SessionCreationError";
    }
}
