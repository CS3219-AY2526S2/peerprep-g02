import { Server, Socket } from "socket.io";

import type {
    JoinSessionPayload,
    SessionEventErrorPayload,
} from "@/models/model.js";
import { SESSION_ERROR } from "@/models/model.js";
import { validateSessionAccess } from "@/services/sessionAccessService.js";
import { sessionPresenceService } from "@/services/sessionPresenceService.js";
import { socketLogger } from "@/utils/logger.js";

type SocketWithSessionData = Socket & {
    data: Socket["data"] & {
        userId?: string;
        sessionId?: string;
        leavingSession?: boolean;
    };
};

async function handleIntentionalLeave(socket: SocketWithSessionData, io: Server): Promise<void> {
    const sessionId = socket.data.sessionId;
    const userId = socket.data.userId;

    if (!sessionId || !userId) {
        return;
    }

    const leaveResult = await sessionPresenceService.markLeft(sessionId, userId);
    socket.leave(sessionId);
    delete socket.data.sessionId;

    socket.emit("session:left", {
        sessionId,
        participantStatuses: sessionPresenceService.getStatuses(sessionId),
    });

    if (leaveResult.statusChanged) {
        socket.to(sessionId).emit("session:peer_left", {
            sessionId,
            userId,
            participantStatuses: sessionPresenceService.getStatuses(sessionId),
        });
    }

    socketLogger.info({ sessionId, userId }, "User left collaboration session intentionally");
}

export function registerCollaborationSocketHandlers(io: Server): void {
    io.on("connection", (rawSocket) => {
        const socket = rawSocket as SocketWithSessionData;
        const userId = socket.data.userId;

        if (!userId) {
            socket.disconnect(true);
            return;
        }

        socketLogger.info({ socketId: socket.id, userId }, "Collaboration socket connected");

        socket.on("session:join", async (payload: JoinSessionPayload = {}) => {
            const sessionId = payload.sessionId;

            if (!sessionId) {
                const errorPayload: SessionEventErrorPayload = {
                    error: SESSION_ERROR.INVALID_SESSION_REQUEST,
                    message: "sessionId is required to join a collaboration session.",
                };
                socket.emit("session:error", errorPayload);
                return;
            }

            if (socket.data.sessionId && socket.data.sessionId !== sessionId) {
                const errorPayload: SessionEventErrorPayload = {
                    error: SESSION_ERROR.INVALID_SESSION_REQUEST,
                    message: "Socket is already joined to another collaboration session.",
                };
                socket.emit("session:error", errorPayload);
                return;
            }

            const accessResult = await validateSessionAccess(sessionId, userId);

            if (!accessResult.ok) {
                socket.emit("session:error", {
                    error: accessResult.error,
                    message: accessResult.message,
                });
                return;
            }

            const presenceResult = await sessionPresenceService.markConnected(sessionId, userId);

            if (!presenceResult.allowed) {
                const errorPayload: SessionEventErrorPayload = {
                    error: SESSION_ERROR.SESSION_CAPACITY_REACHED,
                    message: "No more than two users may be present in a collaboration session.",
                };
                socket.emit("session:error", errorPayload);
                return;
            }

            socket.join(sessionId);
            socket.data.sessionId = sessionId;

            socket.emit("session:joined", {
                session: accessResult.session,
                participantStatuses: sessionPresenceService.getStatuses(sessionId),
            });

            if (presenceResult.statusChanged) {
                socket.to(sessionId).emit("session:peer_joined", {
                    sessionId,
                    userId,
                    participantStatuses: sessionPresenceService.getStatuses(sessionId),
                });
            }

            socketLogger.info({ sessionId, userId }, "User joined collaboration session");
        });

        socket.on("session:leave", async () => {
            socket.data.leavingSession = true;
            await handleIntentionalLeave(socket, io);
        });

        socket.on("disconnect", async (reason) => {
            const sessionId = socket.data.sessionId;

            if (!sessionId || socket.data.leavingSession) {
                return;
            }

            const disconnectResult = await sessionPresenceService.markDisconnected(sessionId, userId);

            if (disconnectResult.statusChanged) {
                socket.to(sessionId).emit("session:peer_disconnected", {
                    sessionId,
                    userId,
                    reason,
                    participantStatuses: sessionPresenceService.getStatuses(sessionId),
                });
            }

            socketLogger.info({ sessionId, userId, reason }, "User disconnected from collaboration session");
        });
    });
}
