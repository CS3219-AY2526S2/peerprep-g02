/** Hosts Socket.IO realtime session events for join, disconnect, and leave notifications. */
import { createServer, type Server as HttpServer } from "node:http";

import type { Server as SocketIOServerType, Socket } from "socket.io";
import { Server } from "socket.io";

import {
    JoinSessionErrorCode,
    SessionRealtimeEvent,
} from "@/models/models.js";
import { SessionJoinError } from "@/services/errors.js";
import { collaborationConfig } from "@/services/config.js";
import { sessionJoinService } from "@/services/sessionJoinService.js";
import { sessionPresenceManager } from "@/services/sessionPresenceManager.js";
import app from "@/app.js";
import { logger } from "@/utils/logger.js";

type JoinedSessionContext = {
    sessionId: string;
    userId: string;
};

type CollaborationSocket = Socket & {
    data: {
        joinedSessions?: JoinedSessionContext[];
    };
};

function roomName(sessionId: string): string {
    return `session:${sessionId}`;
}

function extractAuthorization(socket: Socket): string {
    const header = socket.handshake.headers.authorization;
    const authValue = socket.handshake.auth.authorization;

    if (typeof authValue === "string" && authValue.trim().length > 0) {
        return authValue;
    }

    return typeof header === "string" ? header : "";
}

export function createRealtimeServer(): {
    httpServer: HttpServer;
    io: SocketIOServerType;
} {
    const httpServer = createServer(app);
    const io = new Server(httpServer, {
        cors: {
            origin: collaborationConfig.frontendUrl,
            credentials: true,
        },
    });

    io.on("connection", (rawSocket) => {
        const socket = rawSocket as CollaborationSocket;
        socket.data.joinedSessions = [];

        socket.on("session:join", async ({ sessionId }: { sessionId: string }) => {
            try {
                const joinResult = await sessionJoinService.joinSession(
                    sessionId,
                    extractAuthorization(socket),
                );

                await socket.join(roomName(sessionId));

                const connectionResult = sessionPresenceManager.markConnected(
                    joinResult.session,
                    joinResult.currentUserId,
                    socket.id,
                );

                socket.data.joinedSessions?.push({
                    sessionId,
                    userId: joinResult.currentUserId,
                });

                socket.emit(SessionRealtimeEvent.SESSION_JOINED, {
                    ...joinResult,
                    participants: connectionResult.participants,
                });

                if (connectionResult.firstConnection) {
                    socket.to(roomName(sessionId)).emit(
                        SessionRealtimeEvent.SESSION_PEER_JOINED,
                        {
                            sessionId,
                            userId: joinResult.currentUserId,
                            participants: connectionResult.participants,
                        },
                    );
                }
            } catch (error) {
                const joinError =
                    error instanceof SessionJoinError
                        ? error
                        : new SessionJoinError(
                              500,
                              JoinSessionErrorCode.SERVICE_DEPENDENCY_ERROR,
                              "Unexpected error while joining the session.",
                          );

                socket.emit(SessionRealtimeEvent.SESSION_ERROR, {
                    error: joinError.code,
                    message: joinError.message,
                });
            }
        });

        socket.on("session:leave", async ({ sessionId }: { sessionId: string }) => {
            const joinedSession = socket.data.joinedSessions?.find(
                (item: JoinedSessionContext) => item.sessionId === sessionId,
            );

            if (!joinedSession) {
                return;
            }

            const joinResult = await sessionJoinService
                .joinSession(sessionId, extractAuthorization(socket))
                .catch(() => null);

            if (!joinResult) {
                return;
            }

            const leftResult = sessionPresenceManager.markLeft(
                joinResult.session,
                joinedSession.userId,
                socket.id,
            );

            socket.data.joinedSessions = socket.data.joinedSessions?.filter(
                (item: JoinedSessionContext) =>
                    !(item.sessionId === sessionId && item.userId === joinedSession.userId),
            );

            await socket.leave(roomName(sessionId));

            if (leftResult.becameLeft) {
                socket.to(roomName(sessionId)).emit(
                    SessionRealtimeEvent.SESSION_PEER_LEFT,
                    {
                        sessionId,
                        userId: joinedSession.userId,
                        participants: leftResult.participants,
                    },
                );
            }
        });

        socket.on("disconnect", async () => {
            for (const joinedSession of socket.data.joinedSessions ?? []) {
                const joinResult = await sessionJoinService
                    .joinSession(joinedSession.sessionId, extractAuthorization(socket))
                    .catch(() => null);

                if (!joinResult) {
                    continue;
                }

                const disconnectResult = sessionPresenceManager.markDisconnected(
                    joinResult.session,
                    joinedSession.userId,
                    socket.id,
                );

                if (disconnectResult.becameDisconnected) {
                    socket.to(roomName(joinedSession.sessionId)).emit(
                        SessionRealtimeEvent.SESSION_PEER_DISCONNECTED,
                        {
                            sessionId: joinedSession.sessionId,
                            userId: joinedSession.userId,
                            participants: disconnectResult.participants,
                        },
                    );
                }
            }

            logger.info({ socketId: socket.id }, "Socket disconnected");
        });
    });

    return { httpServer, io };
}
