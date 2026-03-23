import "dotenv/config";

import { Socket } from "socket.io";

import type { InternalAuthResponse } from "@/types/auth.js";
import { socketLogger } from "@/utils/logger.js";

// stub method
// export const socketAuthMiddleware = (socket: Socket, next: (err?: Error) => void) => {
//     const userId = socket.handshake.auth?.userId || socket.handshake.headers?.['x-user-id'];

//     if (!userId) {
//         console.error("Connection rejected: No userId provided in stub mode.");
//         return next(new Error("Authentication failed: userId required"));
//     }

//     socket.data.userId = userId;
//     next();
// };

export const socketAuthMiddleware = async (socket: Socket, next: (err?: Error) => void) => {
    const authHeader = socket.handshake.headers["authorization"] || socket.handshake.auth?.token;
    const serviceKey = process.env.US_INTERNAL_SERVICE_API_KEY || "";

    if (!authHeader) {
        return next(new Error("Authentication failed: No token provided"));
    }

    try {
        const response = await fetch(
            `${process.env.API_GATEWAY_SERVER}/users/internal/authz/context`,
            {
                headers: {
                    authorization: authHeader,
                    "x-internal-service-key": serviceKey,
                },
            },
        );

        if (!response.ok) {
            socketLogger.warn(
                `Authentication failed for socket ${socket.id}: ${response.statusText}`,
            );
            return next(new Error("Unauthorized"));
        }

        const authz = (await response.json()) as InternalAuthResponse;

        if (authz.data.status !== "active") {
            return next(new Error("Forbidden: account is not active"));
        }

        socket.data.userId = authz.data.clerkUserId;
        socket.data.role = authz.data.role;

        next();
    } catch (error) {
        socketLogger.error(error, `Error during socket authentication for socket ${socket.id}`);
        next(new Error("Internal Server Error"));
    }
};
