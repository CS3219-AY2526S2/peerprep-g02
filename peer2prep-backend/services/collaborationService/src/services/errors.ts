/** Defines typed domain errors used to map service failures to API responses. */
import { CreateSessionErrorCode } from "@/models/models.js";
import { JoinSessionErrorCode } from "@/models/models.js";

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

export class SessionJoinError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly code: JoinSessionErrorCode,
        message: string,
    ) {
        super(message);
        this.name = "SessionJoinError";
    }
}
