import { useCallback, useEffect, useRef, useState } from "react";

import { pushToast } from "@/utils/toast";
import type { AiHint, HintUpdatedPayload } from "@/models/collaboration/aiHintType";
import { COLLABORATION_SOCKET_EVENTS } from "@/models/collaboration/collaborationSocketType";
import type {
    CodeChangePayload,
    CodeSyncPayload,
    CollaborationJoinState,
    CollaborationParticipant,
    CollaborationQuestion,
    ExecutionResults,
    OTOperation,
    OutputUpdatedPayload,
    SessionEndedPayload,
    SubmissionCompletePayload,
    UserDisconnectedPayload,
    UserJoinedPayload,
    UserLeftPayload,
} from "@/models/collaboration/collaborationType";

import { collaborationService } from "@/services/collaboration/collaborationService";
import {
    type OfflineChanges,
    OTClient,
    textChangeToOperations,
} from "@/services/collaboration/otClient";

type ConnectionState = "connecting" | "connected" | "reconnecting" | "error";

export function useCollaborationSession(collaborationId: string | undefined) {
    const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
    const [joinState, setJoinState] = useState<CollaborationJoinState | null>(null);
    const [question, setQuestion] = useState<CollaborationQuestion | null>(null);
    const [editorValue, setEditorValue] = useState("");
    const [participants, setParticipants] = useState<CollaborationParticipant[]>([]);
    const [joinError, setJoinError] = useState<string | null>(null);
    const [executionOutput, setExecutionOutput] = useState<string>("");
    const [language, setLanguage] = useState<string>("");
    const [isExecuting, setIsExecuting] = useState(false);
    const [executionResults, setExecutionResults] = useState<ExecutionResults | null>(null);
    const [submissionResult, setSubmissionResult] = useState<SubmissionCompletePayload | null>(
        null,
    );
    // F4.7.4 & F4.7.5 - Track offline changes
    const [offlineChanges, setOfflineChanges] = useState<OfflineChanges | null>(null);
    // F4.8 & F4.9 - Track session ended state
    const [sessionEnded, setSessionEnded] = useState<SessionEndedPayload | null>(null);

    // AI hints state
    const [hints, setHints] = useState<AiHint[]>([]);
    const [isHintLoading, setIsHintLoading] = useState(false);
    const [hintsRemaining, setHintsRemaining] = useState(2);

    // User names mapping (userId -> display name)
    const [userNames, setUserNames] = useState<Record<string, string>>({});
    const userNamesRef = useRef<Record<string, string>>({});

    // OT client reference
    const otClientRef = useRef<OTClient | null>(null);
    const isRemoteChangeRef = useRef(false);
    const collaborationIdRef = useRef(collaborationId);

    // Update ref when collaborationId changes
    useEffect(() => {
        collaborationIdRef.current = collaborationId;
    }, [collaborationId]);

    // Handle local text changes with OT
    const handleEditorChange = useCallback((newValue: string) => {
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
    }, []);

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

    const runCode = useCallback(async () => {
        if (!collaborationId) return;
        setIsExecuting(true);
        setExecutionResults(null);
        try {
            const ack = await collaborationService.runCode(collaborationId);
            if (!ack.ok) {
                pushToast({ tone: "error", message: ack.error ?? "Failed to run code" });
                setIsExecuting(false);
            }
        } catch {
            pushToast({ tone: "error", message: "Failed to run code" });
            setIsExecuting(false);
        }
    }, [collaborationId]);

    const submitCode = useCallback(async () => {
        if (!collaborationId) return;
        setIsExecuting(true);
        setExecutionResults(null);
        setSubmissionResult(null);
        try {
            const ack = await collaborationService.submitCode(collaborationId);
            if (!ack.ok) {
                pushToast({ tone: "error", message: ack.error ?? "Failed to submit code" });
                setIsExecuting(false);
            }
        } catch {
            pushToast({ tone: "error", message: "Failed to submit code" });
            setIsExecuting(false);
        }
    }, [collaborationId]);

    const requestHint = useCallback(async () => {
        if (!collaborationId) return;
        setIsHintLoading(true);
        try {
            const ack = await collaborationService.requestHint(collaborationId);
            if (ack.ok && ack.hints) {
                setHints(ack.hints);
                if (ack.hintsRemaining !== undefined) {
                    setHintsRemaining(ack.hintsRemaining);
                }
            } else {
                pushToast({ tone: "error", message: ack.error ?? "Failed to get hint" });
            }
        } catch {
            pushToast({ tone: "error", message: "Failed to get hint" });
        } finally {
            setIsHintLoading(false);
        }
    }, [collaborationId]);

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
                current === "connected" ? "reconnecting" : "connecting",
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

                // Initialize AI hints and user names from join response
                const joinAck = ack as {
                    hints?: AiHint[];
                    hintsRemaining?: number;
                    userNames?: Record<string, string>;
                };
                if (joinAck.hints) {
                    setHints(joinAck.hints);
                }
                if (joinAck.hintsRemaining !== undefined) {
                    setHintsRemaining(joinAck.hintsRemaining);
                }
                if (joinAck.userNames) {
                    setUserNames(joinAck.userNames);
                    userNamesRef.current = joinAck.userNames;
                }

                // F4.4.2 & F4.4.3 - Initialize OT client with server state (empty for first user, synced for joining user)
                otClient.reset(ack.state.codeSnapshot, ack.state.codeRevision);
                setEditorValue(ack.state.codeSnapshot);

                setConnectionState("connected");
                setJoinError(null);

                // F4.7.2 & F4.7.3 - Show notification if rejoining after disconnect
                // Server state is authoritative - OT client synced above
                if (ack.state.wasDisconnected) {
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

        let hasJoined = false;

        const handleConnect = () => {
            if (hasJoined) {
                // Only re-join on reconnection, not on initial connect
                void joinSession();
            }
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

        const displayName = (uid: string) => userNamesRef.current[uid] ?? "Partner";

        // F4.3.2 - Handle user joined notification
        const handleUserJoined = (payload: UserJoinedPayload) => {
            if (!isMounted || payload.collaborationId !== collaborationId) {
                return;
            }

            const name = displayName(payload.userId);
            const message = payload.wasDisconnected
                ? `${name} has reconnected`
                : `${name} has joined the session`;

            pushToast({ tone: "success", message });
        };

        // F4.6.1 - Handle user disconnected notification
        // F4.6.3 - Session stays active, F4.6.4 - We can continue working
        const handleUserDisconnected = (payload: UserDisconnectedPayload) => {
            if (!isMounted || payload.collaborationId !== collaborationId) {
                return;
            }

            const reasonText =
                payload.reason === "ping timeout"
                    ? " (connection timed out)"
                    : payload.reason === "transport close"
                      ? " (connection lost)"
                      : "";

            const name = displayName(payload.userId);
            pushToast({ tone: "error", message: `${name} has disconnected${reasonText}` });
        };

        // F4.3.4 - Handle user left notification
        const handleUserLeft = (payload: UserLeftPayload) => {
            if (!isMounted || payload.collaborationId !== collaborationId) {
                return;
            }

            const name = displayName(payload.userId);
            pushToast({ tone: "error", message: `${name} has left the session` });
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

            // The server sends execution results as payload.output directly
            const raw = payload.output;
            if (typeof raw === "object" && raw !== null) {
                const output = raw as ExecutionResults | { error?: string };
                if ("results" in output) {
                    setExecutionOutput(JSON.stringify(output, null, 2));
                    setExecutionResults(output);
                } else if ("error" in output && output.error) {
                    setExecutionOutput(output.error);
                    setExecutionResults(null);
                    pushToast({ tone: "error", message: output.error });
                } else {
                    setExecutionOutput(JSON.stringify(raw));
                }
            } else {
                setExecutionOutput(typeof raw === "string" ? raw : JSON.stringify(raw));
            }
            setIsExecuting(false);
        };

        const handleCodeRunning = (payload: { collaborationId: string }) => {
            if (!isMounted || payload.collaborationId !== collaborationId) {
                return;
            }
            setIsExecuting(true);
            setExecutionResults(null);
        };

        const handleSubmissionComplete = (payload: SubmissionCompletePayload) => {
            if (!isMounted || payload.collaborationId !== collaborationId) {
                return;
            }
            setSubmissionResult(payload);
            const message = payload.success
                ? `Solution submitted! All ${payload.totalTestCases} test cases passed!`
                : `Solution submitted. ${payload.testCasesPassed}/${payload.totalTestCases} test cases passed.`;
            pushToast({ tone: payload.success ? "success" : "warning", message });
        };

        // Handle AI hint updates (broadcast from server to all users in room)
        const handleHintUpdated = (payload: HintUpdatedPayload) => {
            if (!isMounted || payload.collaborationId !== collaborationId) {
                return;
            }
            setHints(payload.hints);
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
            socket.on(COLLABORATION_SOCKET_EVENTS.CODE_RUNNING, handleCodeRunning);
            socket.on(COLLABORATION_SOCKET_EVENTS.SUBMISSION_COMPLETE, handleSubmissionComplete);
            socket.on(COLLABORATION_SOCKET_EVENTS.SESSION_ENDED, handleSessionEnded);
            socket.on(COLLABORATION_SOCKET_EVENTS.HINT_UPDATED, handleHintUpdated);

            // Join once after all handlers are registered
            hasJoined = true;
            void joinSession();
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
                socketRef.off(
                    COLLABORATION_SOCKET_EVENTS.USER_DISCONNECTED,
                    handleUserDisconnected,
                );
                socketRef.off(COLLABORATION_SOCKET_EVENTS.USER_LEFT, handleUserLeft);
                socketRef.off(COLLABORATION_SOCKET_EVENTS.CODE_CHANGE, handleCodeChange);
                socketRef.off(COLLABORATION_SOCKET_EVENTS.CODE_SYNC, handleCodeSync);
                socketRef.off(COLLABORATION_SOCKET_EVENTS.OUTPUT_UPDATED, handleOutputUpdated);
                socketRef.off(COLLABORATION_SOCKET_EVENTS.CODE_RUNNING, handleCodeRunning);
                socketRef.off(
                    COLLABORATION_SOCKET_EVENTS.SUBMISSION_COMPLETE,
                    handleSubmissionComplete,
                );
                socketRef.off(COLLABORATION_SOCKET_EVENTS.SESSION_ENDED, handleSessionEnded);
                socketRef.off(COLLABORATION_SOCKET_EVENTS.HINT_UPDATED, handleHintUpdated);
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
        leaveSession,
        executionOutput,
        language,
        // F4.7.4 & F4.7.5 - Offline changes handling
        offlineChanges,
        submitOfflineChanges,
        discardOfflineChanges,
        // F4.8 & F4.9 - Session termination
        sessionEnded,
        // Code execution
        runCode,
        submitCode,
        isExecuting,
        executionResults,
        submissionResult,
        // AI hints
        hints,
        isHintLoading,
        hintsRemaining,
        requestHint,
        // User names
        userNames,
    };
}
