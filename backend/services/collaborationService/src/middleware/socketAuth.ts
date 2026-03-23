import type { Socket } from "socket.io";

import { ERROR_CODES } from "@/config/constants.js";
import { env } from "@/config/env.js";
import { logger } from "@/utils/logger.js";

type InternalAuthResponse = {
    data: {
        clerkUserId: string;
        role?: string;
        status?: string;
    };
};

export async function socketAuthMiddleware(
    socket: Socket,
    next: (err?: Error) => void,
): Promise<void> {
    const authorization =
        socket.handshake.headers["authorization"] ?? socket.handshake.auth?.token;

    logger.info(
        {
            socketId: socket.id,
            hasAuth: !!authorization,
            authType: typeof authorization,
            hasAuthHeader: !!socket.handshake.headers["authorization"],
            hasAuthToken: !!socket.handshake.auth?.token,
        },
        "Socket auth middleware - checking credentials",
    );

    if (!authorization || typeof authorization !== "string") {
        logger.warn({ socketId: socket.id }, "Socket auth failed - no authorization token");
        next(new Error(ERROR_CODES.SOCKET_AUTHENTICATION_FAILED));
        return;
    }

    try {
        const response = await fetch(`${env.userServiceUrl}${env.userAuthContextPath}`, {
            headers: {
                authorization,
                "x-internal-service-key": env.internalServiceApiKey,
            },
        });

        if (!response.ok) {
            next(new Error(ERROR_CODES.SOCKET_AUTHENTICATION_FAILED));
            return;
        }

        const payload = (await response.json()) as InternalAuthResponse;
        if (payload.data.status !== "active" || !payload.data.clerkUserId) {
            next(new Error(ERROR_CODES.SOCKET_AUTHENTICATION_FAILED));
            return;
        }

        socket.data.userId = payload.data.clerkUserId;
        next();
    } catch (error) {
        logger.error({ err: error, socketId: socket.id }, "Socket authentication failed");
        next(new Error(ERROR_CODES.SOCKET_AUTHENTICATION_FAILED));
    }
}
