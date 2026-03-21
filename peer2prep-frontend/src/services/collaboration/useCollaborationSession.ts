import { useEffect, useState } from "react";

import { collaborationService } from "@/services/collaboration/collaborationService";
import { getQuestion } from "@/services/question/questionService";
import { pushToast } from "@/utils/toast";
import type {
    CollaborationJoinState,
    CollaborationParticipant,
    CollaborationQuestion,
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

    useEffect(() => {
        if (!collaborationId) {
            setConnectionState("error");
            setJoinError("A collaboration session id is required.");
            return;
        }

        let isMounted = true;
        let socketRef: Awaited<ReturnType<typeof collaborationService.connect>> | null = null;

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
                setEditorValue(ack.state.codeSnapshot);
                setConnectionState("connected");
                setJoinError(null);

                const fetchedQuestion = await getQuestion(ack.state.questionId as never);
                if (!isMounted || !fetchedQuestion) {
                    return;
                }

                setQuestion({
                    quid: fetchedQuestion.quid as unknown as string,
                    title: fetchedQuestion.title,
                    topics: fetchedQuestion.topics,
                    difficulty: fetchedQuestion.difficulty,
                    description: fetchedQuestion.description,
                    testCase: fetchedQuestion.testCase,
                });
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

        void collaborationService.connect().then((socket) => {
            if (!isMounted) {
                return;
            }

            socketRef = socket;
            socket.on(COLLABORATION_SOCKET_EVENTS.CONNECT, handleConnect);
            socket.on(COLLABORATION_SOCKET_EVENTS.DISCONNECT, handleDisconnect);
            socket.on(COLLABORATION_SOCKET_EVENTS.CONNECT_ERROR, handleConnectError);
            socket.on(COLLABORATION_SOCKET_EVENTS.PRESENCE_UPDATED, handlePresenceUpdated);
        });

        return () => {
            isMounted = false;

            if (socketRef) {
                socketRef.off(COLLABORATION_SOCKET_EVENTS.CONNECT, handleConnect);
                socketRef.off(COLLABORATION_SOCKET_EVENTS.DISCONNECT, handleDisconnect);
                socketRef.off(COLLABORATION_SOCKET_EVENTS.CONNECT_ERROR, handleConnectError);
                socketRef.off(
                    COLLABORATION_SOCKET_EVENTS.PRESENCE_UPDATED,
                    handlePresenceUpdated,
                );
            }
        };
    }, [collaborationId]);

    return {
        connectionState,
        joinState,
        question,
        editorValue,
        setEditorValue,
        participants,
        joinError,
    };
}
