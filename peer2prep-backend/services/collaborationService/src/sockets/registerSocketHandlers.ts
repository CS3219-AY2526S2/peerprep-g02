import type { Server, Socket } from "socket.io";

import { ERROR_CODES, SOCKET_EVENTS } from "@/config/constants.js";
import { collaborationSessionService } from "@/services/collaborationSessionService.js";
import { logger } from "@/utils/logger.js";

type JoinSessionPayload = {
    collaborationId?: string;
};

type SocketAck = (response: {
    ok: boolean;
    state?: ReturnType<typeof collaborationSessionService.joinSession>;
    error?: string;
    message?: string;
}) => void;

function collaborationRoom(collaborationId: string): string {
    return `collaboration:${collaborationId}`;
}

function userRoom(userId: string): string {
    return `user:${userId}`;
}

export function registerSocketHandlers(io: Server): void {
    io.on("connection", (socket: Socket) => {
        const userId = socket.data.userId as string | undefined;

        if (!userId) {
            socket.disconnect(true);
            return;
        }

        socket.join(userRoom(userId));
        socket.emit(SOCKET_EVENTS.CONNECTION_READY, { userId });

        socket.on(
            SOCKET_EVENTS.SESSION_JOIN,
            (payload: JoinSessionPayload, ack?: SocketAck) => {
                if (!payload?.collaborationId || typeof payload.collaborationId !== "string") {
                    ack?.({
                        ok: false,
                        error: ERROR_CODES.INVALID_JOIN_REQUEST,
                        message: "collaborationId is required to join a collaboration session.",
                    });
                    return;
                }

                try {
                    const state = collaborationSessionService.joinSession({
                        collaborationId: payload.collaborationId,
                        userId,
                        socketId: socket.id,
                    });

                    socket.join(collaborationRoom(payload.collaborationId));
                    ack?.({ ok: true, state });

                    io.to(collaborationRoom(payload.collaborationId)).emit(
                        SOCKET_EVENTS.PRESENCE_UPDATED,
                        {
                            collaborationId: payload.collaborationId,
                            participants: state.participants,
                        },
                    );
                } catch (error) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : "Failed to join collaboration session.";
                    const code =
                        error instanceof Error && "code" in error && typeof error.code === "string"
                            ? error.code
                            : ERROR_CODES.INVALID_JOIN_REQUEST;

                    ack?.({
                        ok: false,
                        error: code,
                        message,
                    });
                }
            },
        );

        socket.on("disconnect", () => {
            const result = collaborationSessionService.handleDisconnect(socket.id);
            if (!result) {
                return;
            }

            io.to(collaborationRoom(result.collaborationId)).emit(
                SOCKET_EVENTS.PRESENCE_UPDATED,
                {
                    collaborationId: result.collaborationId,
                    participants: result.participants,
                },
            );
        });

        logger.info({ socketId: socket.id, userId }, "Collaboration socket connected");
    });
}
