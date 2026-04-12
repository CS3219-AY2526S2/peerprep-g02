import { randomUUID, type UUID } from "node:crypto";
import type { Server, Socket } from "socket.io";

import { ERROR_CODES, SOCKET_EVENTS } from "@/config/constants.js";
import { AppError } from "@/utils/errors.js";
import { env } from "@/config/env.js";
import { RabbitMQManager } from "@/managers/rabbitmqManager.js";
import type { OTOperation } from "@/models/session.js";
import { collaborationSessionService } from "@/services/collaborationSessionService.js";
import type { ExecutionRequestMessage } from "@/types/executionRabbitmq.js";
import { logger } from "@/utils/logger.js";
import { getRedisClient } from "@/utils/redis.js";

type JoinSessionPayload = {
    collaborationId?: string;
};

type CodeChangePayload = {
    collaborationId: string;
    revision: number;
    operations: OTOperation[];
};

type LeaveSessionPayload = {
    collaborationId: string;
};

type CodeRunPayload = {
    collaborationId: string;
};

type SocketAck = (response: {
    ok: boolean;
    state?: Awaited<ReturnType<typeof collaborationSessionService.joinSession>>;
    hints?: Awaited<ReturnType<typeof collaborationSessionService.getHints>>;
    hintsRemaining?: number;
    userNames?: Record<string, string>;
    error?: string;
    message?: string;
}) => void;

type CodeAck = (response: { ok: boolean; revision?: number; error?: string }) => void;

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

        /**
         * Check if the authenticated user has an active collaboration session
         */
        socket.on(
            SOCKET_EVENTS.SESSION_CHECK_ACTIVE,
            async (
                _payload: unknown,
                ack?: (response: {
                    ok: boolean;
                    activeSession?: { collaborationId: string; topic: string; difficulty: string } | null;
                }) => void,
            ) => {
                logger.info({ userId, socketId: socket.id }, "Received session:check-active request");
                try {
                    const activeSession =
                        await collaborationSessionService.getActiveSessionForUser(userId);
                    logger.info(
                        { userId, hasActiveSession: !!activeSession, collaborationId: activeSession?.collaborationId },
                        "Active session check result",
                    );
                    ack?.({ ok: true, activeSession: activeSession ?? null });
                } catch (error) {
                    logger.error({ err: error, userId }, "Failed to check active session");
                    ack?.({ ok: false, activeSession: null });
                }
            },
        );

        /**
         * F4.3.2 - Handle session join
         * When a user joins, notify the other user
         */
        socket.on(
            SOCKET_EVENTS.SESSION_JOIN,
            async (payload: JoinSessionPayload, ack?: SocketAck) => {
                if (!payload?.collaborationId || typeof payload.collaborationId !== "string") {
                    ack?.({
                        ok: false,
                        error: ERROR_CODES.INVALID_JOIN_REQUEST,
                        message: "collaborationId is required to join a collaboration session.",
                    });
                    return;
                }

                try {
                    const state = await collaborationSessionService.joinSession({
                        collaborationId: payload.collaborationId as UUID,
                        userId: userId as UUID,
                        socketId: socket.id,
                    });

                    socket.join(collaborationRoom(payload.collaborationId));

                    // Include existing hints and user names in join response
                    const [hints, hintsRemaining, userNames] = await Promise.all([
                        collaborationSessionService.getHints(payload.collaborationId),
                        collaborationSessionService.getHintsRemaining(payload.collaborationId, userId as string),
                        collaborationSessionService.getUserNames([state.session.userAId, state.session.userBId]),
                    ]);

                    // Send full state to joining user
                    ack?.({ ok: true, state, hints, hintsRemaining, userNames });

                    // F4.3.2 - Notify other users in the room that this user joined
                    socket
                        .to(collaborationRoom(payload.collaborationId))
                        .emit(SOCKET_EVENTS.USER_JOINED, {
                            collaborationId: payload.collaborationId,
                            userId,
                            isFirstConnection: state.isFirstConnection,
                            wasDisconnected: state.wasDisconnected,
                        });

                    // Broadcast updated presence to all in room
                    io.to(collaborationRoom(payload.collaborationId)).emit(
                        SOCKET_EVENTS.PRESENCE_UPDATED,
                        {
                            collaborationId: payload.collaborationId,
                            participants: state.participants,
                        },
                    );

                    logger.info(
                        {
                            socketId: socket.id,
                            userId,
                            collaborationId: payload.collaborationId,
                            isFirstConnection: state.isFirstConnection,
                        },
                        "User joined collaboration session",
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

        /**
         * F4.5 - Shared Code Changes
         * F4.5.1 - Allow users in session to modify code while active
         * F4.5.2 - Accept changes only from session participants
         * F4.5.3 - Apply changes in order (OT revision tracking)
         * F4.5.4 - Propagate changes to all connected users
         * F4.5.5 - Ensure both users see same version (OT)
         * F4.5.6 - Resolve concurrent changes with OT conflict resolution
         */
        socket.on(SOCKET_EVENTS.CODE_CHANGE, async (payload: CodeChangePayload, ack?: CodeAck) => {
            if (!payload?.collaborationId || !Array.isArray(payload.operations)) {
                ack?.({
                    ok: false,
                    error: "Invalid code change payload",
                });
                return;
            }

            const result = await collaborationSessionService.applyCodeChange({
                collaborationId: payload.collaborationId as UUID,
                userId: userId as UUID,
                revision: payload.revision,
                operations: payload.operations,
            });

            // F4.5.2 - Reject if not authorized or session inactive
            if (!result.ok) {
                // Send sync if needed
                if (result.needsSync) {
                    const roomState = await collaborationSessionService.getRoomState(
                        payload.collaborationId,
                    );
                    if (roomState) {
                        socket.emit(SOCKET_EVENTS.CODE_SYNC, {
                            collaborationId: payload.collaborationId,
                            code: roomState.code,
                            revision: roomState.codeRevision,
                        });
                    }
                }

                ack?.({
                    ok: false,
                    error: result.error,
                });

                logger.warn(
                    {
                        collaborationId: payload.collaborationId,
                        userId,
                        error: result.error,
                    },
                    "Code change rejected",
                );
                return;
            }

            // Update session activity on code change
            await collaborationSessionService.updateSessionActivity(payload.collaborationId);

            // F4.5.3 - Acknowledge with new revision (confirms order)
            ack?.({
                ok: true,
                revision: result.newRevision,
            });

            // F4.5.4 - Propagate transformed operations to all other connected users
            socket.to(collaborationRoom(payload.collaborationId)).emit(SOCKET_EVENTS.CODE_CHANGE, {
                collaborationId: payload.collaborationId,
                userId,
                revision: result.newRevision,
                operations: result.transformedOps,
            });
        });

        /**
         * F4.8.1 - Inform remaining user when other leaves
         * F4.8.2 - End session when both users leave
         */
        socket.on(
            SOCKET_EVENTS.SESSION_LEAVE,
            async (payload: LeaveSessionPayload, ack?: (response: { ok: boolean }) => void) => {
                if (!payload?.collaborationId) {
                    ack?.({ ok: false });
                    return;
                }

                try {
                    const result = await collaborationSessionService.leaveSession(socket.id, userId);

                    if (!result) {
                        ack?.({ ok: false });
                        return;
                    }

                    // Leave the socket room using the authoritative collaborationId from the binding
                    socket.leave(collaborationRoom(result.collaborationId));

                    if (result.isLastSocket) {
                        // F4.8.1 - Notify other users that this user left intentionally
                        io.to(collaborationRoom(result.collaborationId)).emit(
                            SOCKET_EVENTS.USER_LEFT,
                            {
                                collaborationId: result.collaborationId,
                                userId: result.userId,
                            },
                        );
                    }

                    // Broadcast updated presence
                    io.to(collaborationRoom(result.collaborationId)).emit(
                        SOCKET_EVENTS.PRESENCE_UPDATED,
                        {
                            collaborationId: result.collaborationId,
                            participants: result.participants,
                        },
                    );

                    // F4.8.2 - If session ended (both left), notify all
                    if (result.sessionEnded) {
                        io.to(collaborationRoom(result.collaborationId)).emit(
                            SOCKET_EVENTS.SESSION_ENDED,
                            {
                                collaborationId: result.collaborationId,
                                reason: "both_users_left",
                            },
                        );

                        logger.info(
                            { collaborationId: result.collaborationId },
                            "Session ended - both users left",
                        );
                    }

                    logger.info(
                        {
                            socketId: socket.id,
                            userId,
                            collaborationId: result.collaborationId,
                            sessionEnded: result.sessionEnded,
                        },
                        "User intentionally left collaboration session",
                    );

                    ack?.({ ok: true });
                } catch (error) {
                    logger.error(
                        { err: error, socketId: socket.id, userId, collaborationId: payload.collaborationId },
                        "Error processing session leave",
                    );
                    ack?.({ ok: false });
                }
            },
        );

        /**
         * AI Hints - Request an AI-generated hint (max 2 per user per session).
         * Calls Gemini API with the question context and current code.
         * Broadcasts the hint to all users in the room.
         */
        socket.on(
            SOCKET_EVENTS.HINT_REQUEST,
            async (
                payload: { collaborationId?: string },
                ack?: (response: {
                    ok: boolean;
                    hints?: Awaited<ReturnType<typeof collaborationSessionService.getHints>>;
                    hintsRemaining?: number;
                    error?: string;
                }) => void,
            ) => {
                if (!payload?.collaborationId) {
                    ack?.({ ok: false, error: "collaborationId is required." });
                    return;
                }

                try {
                    const result = await collaborationSessionService.requestHint(
                        payload.collaborationId,
                        userId as string,
                    );

                    ack?.({
                        ok: true,
                        hints: result.hints,
                        hintsRemaining: result.hintsRemaining,
                    });

                    // Broadcast updated hints to all users in the room
                    io.to(collaborationRoom(payload.collaborationId)).emit(
                        SOCKET_EVENTS.HINT_UPDATED,
                        {
                            collaborationId: payload.collaborationId,
                            hints: result.hints,
                            requestedBy: userId,
                        },
                    );

                    logger.info(
                        {
                            socketId: socket.id,
                            userId,
                            collaborationId: payload.collaborationId,
                            hintsRemaining: result.hintsRemaining,
                            totalHints: result.hints.length,
                        },
                        "AI hint generated",
                    );
                } catch (error) {
                    const message =
                        error instanceof AppError ? error.message : "Failed to generate hint.";
                    ack?.({ ok: false, error: message });

                    logger.error(
                        { err: error, collaborationId: payload.collaborationId, userId },
                        "AI hint request failed",
                    );
                }
            },
        );

        /**
         * Code execution - Run code against test cases (no attempt recorded)
         * Publishes to RabbitMQ exec_req_queue; results arrive via the response consumer.
         */
        socket.on(
            SOCKET_EVENTS.CODE_RUN,
            async (payload: CodeRunPayload, ack?: (response: { ok: boolean; error?: string }) => void) => {
                if (!payload?.collaborationId) {
                    ack?.({ ok: false, error: "collaborationId is required." });
                    return;
                }

                try {
                    // Notify room that execution is starting
                    io.to(collaborationRoom(payload.collaborationId)).emit(
                        SOCKET_EVENTS.CODE_RUNNING,
                        { collaborationId: payload.collaborationId },
                    );

                    const execData = await collaborationSessionService.getSessionForExecution(
                        payload.collaborationId,
                    );
                    if (!execData) {
                        io.to(collaborationRoom(payload.collaborationId)).emit(
                            SOCKET_EVENTS.OUTPUT_UPDATED,
                            { collaborationId: payload.collaborationId, output: { error: "Session not found or inactive." } },
                        );
                        ack?.({ ok: false, error: "Session not found or inactive." });
                        return;
                    }

                    const correlationId = randomUUID();
                    const message: ExecutionRequestMessage = {
                        correlationId,
                        collaborationId: payload.collaborationId,
                        userId: userId!,
                        type: "run",
                        code: execData.code,
                        language: execData.session.language,
                        functionName: execData.functionName,
                        testCases: execData.testCases,
                        questionId: execData.session.questionId,
                        questionTitle: execData.questionTitle,
                        difficulty: execData.session.difficulty,
                        sessionCreatedAt: execData.session.createdAt,
                    };

                    // Set the pending key before publishing so a Redis failure
                    // doesn't cause a false error after the message is already enqueued.
                    const redis = getRedisClient();
                    let hasTimeoutSafety = false;
                    try {
                        await redis.set(`exec:pending:${correlationId}`, payload.collaborationId, "EX", 65);
                        hasTimeoutSafety = true;
                    } catch (redisErr) {
                        logger.warn(
                            { err: redisErr, correlationId, collaborationId: payload.collaborationId },
                            "Failed to set exec:pending key (timeout safety net unavailable)",
                        );
                    }

                    const published = RabbitMQManager.getInstance().publishExecutionRequest(message);
                    if (!published) {
                        // Clean up the pending key if we managed to set it
                        if (hasTimeoutSafety) {
                            redis.del(`exec:pending:${correlationId}`).catch(() => {});
                        }
                        io.to(collaborationRoom(payload.collaborationId)).emit(
                            SOCKET_EVENTS.OUTPUT_UPDATED,
                            { collaborationId: payload.collaborationId, output: { error: "Execution service unavailable." } },
                        );
                        ack?.({ ok: false, error: "Execution service unavailable." });
                        return;
                    }

                    // Schedule a timeout to stop spinners if no response arrives
                    if (hasTimeoutSafety) {
                        setTimeout(async () => {
                            try {
                                const pending = await redis.get(`exec:pending:${correlationId}`);
                                if (pending) {
                                    await redis.del(`exec:pending:${correlationId}`);
                                    io.to(collaborationRoom(payload.collaborationId)).emit(
                                        SOCKET_EVENTS.OUTPUT_UPDATED,
                                        {
                                            collaborationId: payload.collaborationId,
                                            output: { error: "Code execution timed out." },
                                        },
                                    );
                                }
                            } catch (timeoutErr) {
                                logger.error(
                                    { err: timeoutErr, correlationId, collaborationId: payload.collaborationId },
                                    "Error in execution timeout handler",
                                );
                            }
                        }, 65_000);
                    }

                    ack?.({ ok: true });

                    logger.info(
                        {
                            correlationId,
                            collaborationId: payload.collaborationId,
                            userId,
                        },
                        "Code execution request published to queue",
                    );
                } catch (error) {
                    const message =
                        error instanceof Error ? error.message : "Code execution failed.";
                    logger.error(
                        { err: error, collaborationId: payload.collaborationId },
                        "Failed to publish code execution request",
                    );

                    io.to(collaborationRoom(payload.collaborationId)).emit(
                        SOCKET_EVENTS.OUTPUT_UPDATED,
                        {
                            collaborationId: payload.collaborationId,
                            output: { error: message },
                        },
                    );

                    ack?.({ ok: false, error: message });
                }
            },
        );

        /**
         * Code submission - Run code + record attempt for the submitting user.
         * Publishes to RabbitMQ exec_req_queue; results and attempt recording
         * are handled by the response consumer.
         */
        socket.on(
            SOCKET_EVENTS.CODE_SUBMIT,
            async (payload: CodeRunPayload, ack?: (response: { ok: boolean; error?: string }) => void) => {
                if (!payload?.collaborationId) {
                    ack?.({ ok: false, error: "collaborationId is required." });
                    return;
                }

                try {
                    // Notify room that execution is starting
                    io.to(collaborationRoom(payload.collaborationId)).emit(
                        SOCKET_EVENTS.CODE_RUNNING,
                        { collaborationId: payload.collaborationId },
                    );

                    const execData = await collaborationSessionService.getSessionForExecution(
                        payload.collaborationId,
                    );
                    if (!execData) {
                        io.to(collaborationRoom(payload.collaborationId)).emit(
                            SOCKET_EVENTS.OUTPUT_UPDATED,
                            { collaborationId: payload.collaborationId, output: { error: "Session not found or inactive." } },
                        );
                        ack?.({ ok: false, error: "Session not found or inactive." });
                        return;
                    }

                    const correlationId = randomUUID();
                    const message: ExecutionRequestMessage = {
                        correlationId,
                        collaborationId: payload.collaborationId,
                        userId: userId!,
                        type: "submit",
                        code: execData.code,
                        language: execData.session.language,
                        functionName: execData.functionName,
                        testCases: execData.testCases,
                        questionId: execData.session.questionId,
                        questionTitle: execData.questionTitle,
                        difficulty: execData.session.difficulty,
                        sessionCreatedAt: execData.session.createdAt,
                    };

                    // Set the pending key before publishing so a Redis failure
                    // doesn't cause a false error after the message is already enqueued.
                    const redis = getRedisClient();
                    let hasTimeoutSafety = false;
                    try {
                        await redis.set(`exec:pending:${correlationId}`, payload.collaborationId, "EX", 65);
                        hasTimeoutSafety = true;
                    } catch (redisErr) {
                        logger.warn(
                            { err: redisErr, correlationId, collaborationId: payload.collaborationId },
                            "Failed to set exec:pending key (timeout safety net unavailable)",
                        );
                    }

                    const published = RabbitMQManager.getInstance().publishExecutionRequest(message);
                    if (!published) {
                        // Clean up the pending key if we managed to set it
                        if (hasTimeoutSafety) {
                            redis.del(`exec:pending:${correlationId}`).catch(() => {});
                        }
                        io.to(collaborationRoom(payload.collaborationId)).emit(
                            SOCKET_EVENTS.OUTPUT_UPDATED,
                            { collaborationId: payload.collaborationId, output: { error: "Execution service unavailable." } },
                        );
                        ack?.({ ok: false, error: "Execution service unavailable." });
                        return;
                    }

                    // Schedule a timeout to stop spinners if no response arrives
                    if (hasTimeoutSafety) {
                        setTimeout(async () => {
                            try {
                                const pending = await redis.get(`exec:pending:${correlationId}`);
                                if (pending) {
                                    await redis.del(`exec:pending:${correlationId}`);
                                    io.to(collaborationRoom(payload.collaborationId)).emit(
                                        SOCKET_EVENTS.OUTPUT_UPDATED,
                                        {
                                            collaborationId: payload.collaborationId,
                                            output: { error: "Code execution timed out." },
                                        },
                                    );
                                }
                            } catch (timeoutErr) {
                                logger.error(
                                    { err: timeoutErr, correlationId, collaborationId: payload.collaborationId },
                                    "Error in submission timeout handler",
                                );
                            }
                        }, 65_000);
                    }

                    ack?.({ ok: true });

                    logger.info(
                        {
                            correlationId,
                            collaborationId: payload.collaborationId,
                            userId,
                        },
                        "Code submission request published to queue",
                    );
                } catch (error) {
                    const message =
                        error instanceof Error ? error.message : "Code submission failed.";
                    logger.error(
                        { err: error, collaborationId: payload.collaborationId },
                        "Failed to publish code submission request",
                    );

                    io.to(collaborationRoom(payload.collaborationId)).emit(
                        SOCKET_EVENTS.OUTPUT_UPDATED,
                        {
                            collaborationId: payload.collaborationId,
                            output: { error: message },
                        },
                    );

                    ack?.({ ok: false, error: message });
                }
            },
        );

        /**
         * F4.6.1 - Detect unexpected disconnection
         * F4.6.2 - Mark user as disconnected when connection lost
         * F4.6.3 - Session stays active (handled by not ending session)
         * F4.6.4 - Other user can continue (no blocking)
         */
        socket.on("disconnect", async (reason) => {
            const result = await collaborationSessionService.handleDisconnect(socket.id);
            if (!result) {
                return;
            }

            // F4.6.1 - Log disconnect with reason for monitoring
            logger.info(
                {
                    socketId: socket.id,
                    userId,
                    collaborationId: result.collaborationId,
                    isLastConnection: result.isLastConnection,
                    disconnectReason: reason,
                },
                "User disconnected from collaboration session",
            );

            // F4.6.2 - Notify only if user's last connection (they're fully disconnected)
            if (result.isLastConnection) {
                // F4.6.3 & F4.6.4 - Session stays active, notify other user
                io.to(collaborationRoom(result.collaborationId)).emit(
                    SOCKET_EVENTS.USER_DISCONNECTED,
                    {
                        collaborationId: result.collaborationId,
                        userId: result.userId,
                        reason: reason, // "transport close", "ping timeout", etc.
                    },
                );
            }

            // Always broadcast updated presence
            io.to(collaborationRoom(result.collaborationId)).emit(SOCKET_EVENTS.PRESENCE_UPDATED, {
                collaborationId: result.collaborationId,
                participants: result.participants,
            });
        });

        logger.info({ socketId: socket.id, userId }, "Collaboration socket connected");
    });

    /**
     * F4.8.3 - Periodic check for inactive sessions
     * Uses a distributed Redis lock (SET NX PX) to ensure only one instance
     * runs the check per interval when scaling horizontally.
     */
    const redis = getRedisClient();
    const lockKey = "distributed-lock:inactivity-check";
    const lockDurationMs = Math.max(env.inactivityCheckIntervalMs - 5000, 10000);

    setInterval(async () => {
        try {
            // Acquire distributed lock — skip if another instance holds it
            const acquired = await redis.set(lockKey, "1", "NX", "PX", lockDurationMs);
            if (!acquired) return;

            const inactiveSessionIds = await collaborationSessionService.getInactiveSessions(
                env.sessionInactivityTimeoutMs,
            );

            for (const collaborationId of inactiveSessionIds) {
                const endResult = await collaborationSessionService.endSession(
                    collaborationId,
                    "inactivity_timeout",
                );

                if (endResult) {
                    // Notify all users in the session that it has ended
                    io.to(collaborationRoom(collaborationId)).emit(SOCKET_EVENTS.SESSION_ENDED, {
                        collaborationId,
                        reason: "inactivity_timeout",
                    });

                    logger.info(
                        { collaborationId, reason: "inactivity_timeout" },
                        "Session ended due to inactivity",
                    );
                }
            }
        } catch (error) {
            logger.error({ err: error }, "Error checking for inactive sessions");
        }
    }, env.inactivityCheckIntervalMs);
}
