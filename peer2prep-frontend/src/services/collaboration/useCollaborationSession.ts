import { useCallback, useEffect, useRef, useState } from "react";

import { collaborationService } from "@/services/collaboration/collaborationService";
import { OTClient, textChangeToOperations, type OfflineChanges } from "@/services/collaboration/otClient";
import { pushToast } from "@/utils/toast";
import type {
    CodeChangePayload,
    CodeSyncPayload,
    CollaborationJoinState,
    CollaborationParticipant,
    CollaborationQuestion,
    OTOperation,
    OutputUpdatedPayload,
    SessionEndedPayload,
    UserDisconnectedPayload,
    UserJoinedPayload,
    UserLeftPayload,
} from "@/models/collaboration/collaborationType";
import { COLLABORATION_SOCKET_EVENTS } from "@/models/collaboration/collaborationSocketType";

type ConnectionState = "connecting" | "connected" | "reconnecting" | "error";

export function useCollaborationSession(collaborationId: string | undefined) {
    const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
    const [joinState, setJoinState] = useState<CollaborationJoinState | null>(null);
    const [question, setQuestion] = useState<CollaborationQuestion | null>(null);
    const [editorValue, setEditorValue] = useState("");
    const [participants, setParticipants] = useState<CollaborationParticipant[]>([]);
    const [joinError, setJoinError] = useState<string | null>(null);
    const [partnerNotification, setPartnerNotification] = useState<string | null>(null);
    const [executionOutput, setExecutionOutput] = useState<string>("");
    const [language, setLanguage] = useState<string>("");
    // F4.7.4 & F4.7.5 - Track offline changes
    const [offlineChanges, setOfflineChanges] = useState<OfflineChanges | null>(null);
    // F4.8 & F4.9 - Track session ended state
    const [sessionEnded, setSessionEnded] = useState<SessionEndedPayload | null>(null);

    // OT client reference
    const otClientRef = useRef<OTClient | null>(null);
    const isRemoteChangeRef = useRef(false);
    const collaborationIdRef = useRef(collaborationId);

    // Update ref when collaborationId changes
    useEffect(() => {
        collaborationIdRef.current = collaborationId;
    }, [collaborationId]);

    // Handle local text changes with OT
    const handleEditorChange = useCallback(
        (newValue: string) => {
            if (isRemoteChangeRef.current) {
                // This change came from a remote operation, don't send it back
                setEditorValue(newValue);
                return;
            }

            const otClient = otClientRef.current;
            if (!otClient || !collaborationIdRef.current) {
                setEditorValue(newValue);
                return;
            }

            const oldValue = otClient.getDocument();
            const operations = textChangeToOperations(oldValue, newValue, 0, 0);

            if (operations.length === 0) {
                return;
            }

            // Apply locally and send to server
            const updatedDoc = otClient.applyLocalOperation(operations);
            setEditorValue(updatedDoc);
        },
        []
    );

    // Leave session intentionally
    const leaveSession = useCallback(async () => {
        if (!collaborationId) {
            return;
        }

        try {
            await collaborationService.leaveSession(collaborationId);
        } catch {
            // Ignore errors on leave
        } finally {
            collaborationService.disconnect();
        }
    }, [collaborationId]);

    // F4.7.5 - Submit offline changes after reconnection
    const submitOfflineChanges = useCallback(() => {
        const otClient = otClientRef.current;
        if (!otClient || !offlineChanges) {
            return;
        }

        const ops = otClient.submitOfflineChanges();
        if (ops) {
            // Update editor with the merged result
            setEditorValue(otClient.getDocument());
            pushToast({ tone: "success", message: "Offline changes submitted" });
        }
        setOfflineChanges(null);
    }, [offlineChanges]);

    // F4.7.4 - Discard offline changes (don't merge)
    const discardOfflineChanges = useCallback(() => {
        const otClient = otClientRef.current;
        if (otClient) {
            otClient.clearOfflineChanges();
        }
        setOfflineChanges(null);
        pushToast({ tone: "info", message: "Offline changes discarded" });
    }, []);

    useEffect(() => {
        if (!collaborationId) {
            setConnectionState("error");
            setJoinError("A collaboration session id is required.");
            return;
        }

        let isMounted = true;
        let socketRef: Awaited<ReturnType<typeof collaborationService.connect>> | null = null;

        // Initialize OT client
        const otClient = new OTClient("", 0);
        otClientRef.current = otClient;

        // Set up OT client to send operations
        otClient.setOnSendOperations((revision: number, operations: OTOperation[]) => {
            if (!collaborationIdRef.current) {
                return;
            }

            collaborationService
                .sendCodeChange(collaborationIdRef.current, revision, operations)
                .then((ack) => {
                    if (ack.ok && ack.revision !== undefined) {
                        otClient.handleServerAck(ack.revision);
                    }
                })
                .catch(() => {
                    // Handle error - might need sync
                });
        });

        const joinSession = async () => {
            setConnectionState((current) =>
                current === "connected" ? "reconnecting" : "connecting"
            );

            try {
                const socket = await collaborationService.connect();
                socketRef = socket;

                const ack = await collaborationService.joinSession(collaborationId);
                if (!isMounted) {
                    return;
                }

                if (!ack.ok) {
                    setConnectionState("error");
                    setJoinError(ack.message);
                    pushToast({ tone: "error", message: ack.message });
                    return;
                }

                setJoinState(ack.state);
                setParticipants(ack.state.participants);
                setLanguage(ack.state.session.language);

                // F4.4.2 & F4.4.3 - Initialize OT client with server state (empty for first user, synced for joining user)
                otClient.reset(ack.state.codeSnapshot, ack.state.codeRevision);
                setEditorValue(ack.state.codeSnapshot);

                setConnectionState("connected");
                setJoinError(null);

                // F4.7.2 & F4.7.3 - Show notification if rejoining after disconnect
                // Server state is authoritative - OT client synced above
                if (ack.state.wasDisconnected) {
                    const durationSec = Math.round(ack.state.disconnectDurationMs / 1000);
                    pushToast({
                        tone: "info",
                        message: `Reconnected to session (was disconnected for ${durationSec}s)`,
                    });

                    // F4.7.4 & F4.7.5 - Check for offline changes
                    if (otClient.hasOfflineChanges()) {
                        setOfflineChanges(otClient.getOfflineChanges());
                        pushToast({
                            tone: "warning",
                            message: "You have unsaved changes from when you were offline",
                        });
                    }
                }

                // Use question from join response (fetched by collaboration service internally)
                if (ack.state.question) {
                    setQuestion({
                        quid: ack.state.question.quid,
                        title: ack.state.question.title,
                        topics: ack.state.question.topics,
                        difficulty: ack.state.question.difficulty,
                        description: ack.state.question.description,
                        testCase: ack.state.question.testCase,
                    });
                }
            } catch (error) {
                if (!isMounted) {
                    return;
                }

                const message =
                    error instanceof Error
                        ? error.message
                        : "Unable to connect to the collaboration session.";
                setConnectionState("error");
                setJoinError(message);
                pushToast({ tone: "error", message });
            }
        };

        void joinSession();

        const handleConnect = () => {
            void joinSession();
        };

        const handleDisconnect = () => {
            if (!isMounted) {
                return;
            }

            setConnectionState("reconnecting");
        };

        const handleConnectError = () => {
            if (!isMounted) {
                return;
            }

            setConnectionState("error");
            setJoinError("Failed to authenticate or connect to the collaboration session.");
        };

        const handlePresenceUpdated = (payload: {
            collaborationId: string;
            participants: CollaborationParticipant[];
        }) => {
            if (!isMounted || payload.collaborationId !== collaborationId) {
                return;
            }

            setParticipants(payload.participants);
        };

        // F4.3.2 - Handle user joined notification
        const handleUserJoined = (payload: UserJoinedPayload) => {
            if (!isMounted || payload.collaborationId !== collaborationId) {
                return;
            }

            const message = payload.wasDisconnected
                ? `${payload.userId} has reconnected`
                : `${payload.userId} has joined the session`;

            setPartnerNotification(message);
            pushToast({ tone: "info", message });

            // Clear notification after 3 seconds
            setTimeout(() => {
                if (isMounted) {
                    setPartnerNotification(null);
                }
            }, 3000);
        };

        // F4.6.1 - Handle user disconnected notification
        // F4.6.3 - Session stays active, F4.6.4 - We can continue working
        const handleUserDisconnected = (payload: UserDisconnectedPayload) => {
            if (!isMounted || payload.collaborationId !== collaborationId) {
                return;
            }

            const reasonText = payload.reason === "ping timeout"
                ? " (connection timed out)"
                : payload.reason === "transport close"
                  ? " (connection lost)"
                  : "";

            const message = `${payload.userId} has disconnected${reasonText}`;
            setPartnerNotification(message);
            pushToast({ tone: "warning", message });

            setTimeout(() => {
                if (isMounted) {
                    setPartnerNotification(null);
                }
            }, 5000); // Longer timeout for disconnect notices
        };

        // F4.3.4 - Handle user left notification
        const handleUserLeft = (payload: UserLeftPayload) => {
            if (!isMounted || payload.collaborationId !== collaborationId) {
                return;
            }

            const message = `${payload.userId} has left the session`;
            setPartnerNotification(message);
            pushToast({ tone: "warning", message });
        };

        // F4.4.3 - Handle remote code changes
        const handleCodeChange = (payload: CodeChangePayload) => {
            if (!isMounted || payload.collaborationId !== collaborationId) {
                return;
            }

            isRemoteChangeRef.current = true;
            const newDoc = otClient.handleServerOperation(payload.operations, payload.revision);
            setEditorValue(newDoc);
            isRemoteChangeRef.current = false;
        };

        // F4.4.3 - Handle full code sync
        const handleCodeSync = (payload: CodeSyncPayload) => {
            if (!isMounted || payload.collaborationId !== collaborationId) {
                return;
            }

            isRemoteChangeRef.current = true;
            otClient.handleSync(payload.code, payload.revision);
            setEditorValue(payload.code);
            isRemoteChangeRef.current = false;
        };

        // F4.4.4 - Handle output updates (shared execution output)
        const handleOutputUpdated = (payload: OutputUpdatedPayload) => {
            if (!isMounted || payload.collaborationId !== collaborationId) {
                return;
            }

            setExecutionOutput(payload.output);
        };

        // F4.8.2 & F4.8.3 - Handle session ended
        const handleSessionEnded = (payload: SessionEndedPayload) => {
            if (!isMounted || payload.collaborationId !== collaborationId) {
                return;
            }

            setSessionEnded(payload);

            const reasonText =
                payload.reason === "both_users_left"
                    ? "Both users have left"
                    : payload.reason === "inactivity_timeout"
                      ? "Session timed out due to inactivity"
                      : "Session ended";

            pushToast({ tone: "warning", message: reasonText });
        };

        void collaborationService.connect().then((socket) => {
            if (!isMounted) {
                return;
            }

            socketRef = socket;
            socket.on(COLLABORATION_SOCKET_EVENTS.CONNECT, handleConnect);
            socket.on(COLLABORATION_SOCKET_EVENTS.DISCONNECT, handleDisconnect);
            socket.on(COLLABORATION_SOCKET_EVENTS.CONNECT_ERROR, handleConnectError);
            socket.on(COLLABORATION_SOCKET_EVENTS.PRESENCE_UPDATED, handlePresenceUpdated);
            socket.on(COLLABORATION_SOCKET_EVENTS.USER_JOINED, handleUserJoined);
            socket.on(COLLABORATION_SOCKET_EVENTS.USER_DISCONNECTED, handleUserDisconnected);
            socket.on(COLLABORATION_SOCKET_EVENTS.USER_LEFT, handleUserLeft);
            socket.on(COLLABORATION_SOCKET_EVENTS.CODE_CHANGE, handleCodeChange);
            socket.on(COLLABORATION_SOCKET_EVENTS.CODE_SYNC, handleCodeSync);
            socket.on(COLLABORATION_SOCKET_EVENTS.OUTPUT_UPDATED, handleOutputUpdated);
            socket.on(COLLABORATION_SOCKET_EVENTS.SESSION_ENDED, handleSessionEnded);
        });

        return () => {
            isMounted = false;
            otClientRef.current = null;

            if (socketRef) {
                socketRef.off(COLLABORATION_SOCKET_EVENTS.CONNECT, handleConnect);
                socketRef.off(COLLABORATION_SOCKET_EVENTS.DISCONNECT, handleDisconnect);
                socketRef.off(COLLABORATION_SOCKET_EVENTS.CONNECT_ERROR, handleConnectError);
                socketRef.off(COLLABORATION_SOCKET_EVENTS.PRESENCE_UPDATED, handlePresenceUpdated);
                socketRef.off(COLLABORATION_SOCKET_EVENTS.USER_JOINED, handleUserJoined);
                socketRef.off(COLLABORATION_SOCKET_EVENTS.USER_DISCONNECTED, handleUserDisconnected);
                socketRef.off(COLLABORATION_SOCKET_EVENTS.USER_LEFT, handleUserLeft);
                socketRef.off(COLLABORATION_SOCKET_EVENTS.CODE_CHANGE, handleCodeChange);
                socketRef.off(COLLABORATION_SOCKET_EVENTS.CODE_SYNC, handleCodeSync);
                socketRef.off(COLLABORATION_SOCKET_EVENTS.OUTPUT_UPDATED, handleOutputUpdated);
                socketRef.off(COLLABORATION_SOCKET_EVENTS.SESSION_ENDED, handleSessionEnded);
            }
        };
    }, [collaborationId]);

    return {
        connectionState,
        joinState,
        question,
        editorValue,
        setEditorValue: handleEditorChange,
        participants,
        joinError,
        partnerNotification,
        leaveSession,
        executionOutput,
        language,
        // F4.7.4 & F4.7.5 - Offline changes handling
        offlineChanges,
        submitOfflineChanges,
        discardOfflineChanges,
        // F4.8 & F4.9 - Session termination
        sessionEnded,
    };
}
