import { Socket } from "socket.io";

import { fetchAuthenticatedUserContext } from "@/services/userAuthService.js";
import { socketLogger } from "@/utils/logger.js";

export async function socketAuthMiddleware(
    socket: Socket,
    next: (err?: Error) => void,
): Promise<void> {
    const authHeader =
        socket.handshake.headers["authorization"] ??
        (typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : undefined);

    const authContext = await fetchAuthenticatedUserContext(
        typeof authHeader === "string" ? authHeader : undefined,
    );

    if (!authContext.ok) {
        if (authContext.reason === "dependency_error") {
            socketLogger.warn({ socketId: socket.id }, "Socket auth failed due to user service dependency");
            next(new Error("USER_SERVICE_UNAVAILABLE"));
            return;
        }

        socketLogger.warn({ socketId: socket.id }, "Socket auth failed due to missing authentication");
        next(new Error("UNAUTHORIZED"));
        return;
    }

    socket.data.userId = authContext.userId;
    socket.data.role = authContext.role;
    next();
}
