import type { UUID } from "node:crypto";
import type { Server, Socket } from "socket.io";

import { ERROR_CODES, SOCKET_EVENTS } from "@/config/constants.js";
import { env } from "@/config/env.js";
import type { OTOperation } from "@/models/session.js";
import { AttemptRecordingService } from "@/services/attemptRecordingService.js";
import { CodeExecutionService } from "@/services/codeExecutionService.js";
import { collaborationSessionService } from "@/services/collaborationSessionService.js";
import { logger } from "@/utils/logger.js";

const codeExecutionService = new CodeExecutionService();
const attemptRecordingService = new AttemptRecordingService();

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

                    // Send full state to joining user
                    ack?.({ ok: true, state });

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

                const result = await collaborationSessionService.leaveSession(socket.id, userId);

                if (!result) {
                    ack?.({ ok: false });
                    return;
                }

                // Leave the socket room
                socket.leave(collaborationRoom(payload.collaborationId));

                // F4.8.1 - Notify other users that this user left intentionally
                io.to(collaborationRoom(result.collaborationId)).emit(SOCKET_EVENTS.USER_LEFT, {
                    collaborationId: result.collaborationId,
                    userId: result.userId,
                });

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
            },
        );

        /**
         * Code execution - Run code against test cases (no attempt recorded)
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

                    const result = await codeExecutionService.execute(
                        execData.code,
                        execData.session.language,
                        execData.functionName,
                        execData.testCases,
                    );

                    // Store structured results in Redis
                    await collaborationSessionService.updateOutput(
                        payload.collaborationId,
                        JSON.stringify(result),
                    );

                    // Broadcast results to all users in the room
                    io.to(collaborationRoom(payload.collaborationId)).emit(
                        SOCKET_EVENTS.OUTPUT_UPDATED,
                        {
                            collaborationId: payload.collaborationId,
                            output: result,
                        },
                    );

                    ack?.({ ok: true });

                    logger.info(
                        {
                            collaborationId: payload.collaborationId,
                            userId,
                            testCasesPassed: result.testCasesPassed,
                            totalTestCases: result.totalTestCases,
                        },
                        "Code execution completed",
                    );
                } catch (error) {
                    const message =
                        error instanceof Error ? error.message : "Code execution failed.";
                    logger.error(
                        { err: error, collaborationId: payload.collaborationId },
                        "Code execution failed",
                    );

                    // Broadcast error to all users so their spinners stop
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
         * Code submission - Run code + record attempt for both users
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

                    // Execute code against test cases
                    const result = await codeExecutionService.execute(
                        execData.code,
                        execData.session.language,
                        execData.functionName,
                        execData.testCases,
                    );

                    // Store results
                    await collaborationSessionService.updateOutput(
                        payload.collaborationId,
                        JSON.stringify(result),
                    );

                    // Broadcast execution results
                    io.to(collaborationRoom(payload.collaborationId)).emit(
                        SOCKET_EVENTS.OUTPUT_UPDATED,
                        {
                            collaborationId: payload.collaborationId,
                            output: result,
                        },
                    );

                    // Record attempt for the submitting user only
                    const session = execData.session;
                    const duration = Math.round(
                        (Date.now() - new Date(session.createdAt).getTime()) / 1000,
                    );
                    const success =
                        result.testCasesPassed === result.totalTestCases &&
                        result.totalTestCases > 0;

                    try {
                        await attemptRecordingService.recordAttempt({
                            userId,
                            collaborationId: payload.collaborationId,
                            questionId: session.questionId,
                            questionTitle: execData.questionTitle,
                            language: session.language,
                            difficulty: session.difficulty,
                            success,
                            duration,
                            totalTestCases: result.totalTestCases,
                            testCasesPassed: result.testCasesPassed,
                        });

                        // Send submission confirmation to the submitter only
                        socket.emit(
                            SOCKET_EVENTS.SUBMISSION_COMPLETE,
                            {
                                collaborationId: payload.collaborationId,
                                success,
                                totalTestCases: result.totalTestCases,
                                testCasesPassed: result.testCasesPassed,
                            },
                        );

                        ack?.({ ok: true });
                    } catch (attemptError) {
                        logger.error(
                            { err: attemptError, collaborationId: payload.collaborationId },
                            "Failed to record attempt",
                        );
                        ack?.({ ok: false, error: "Code executed but failed to record attempt." });
                    }

                    logger.info(
                        {
                            collaborationId: payload.collaborationId,
                            userId,
                            success,
                            testCasesPassed: result.testCasesPassed,
                            totalTestCases: result.totalTestCases,
                        },
                        "Code submitted and attempt recorded",
                    );
                } catch (error) {
                    const message =
                        error instanceof Error ? error.message : "Code submission failed.";
                    logger.error(
                        { err: error, collaborationId: payload.collaborationId },
                        "Code submission failed",
                    );

                    // Broadcast error to all users so their spinners stop
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
     */
    setInterval(async () => {
        try {
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
