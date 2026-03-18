import { useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getOriginFromApiBase } from "@/lib/apiClient";
import { pushToast } from "@/lib/toast";
import {
    ActivityMessage,
    ActivityTone,
    CollaborationQuestionDetail,
    ParticipantPresence,
    ParticipantPresenceStatus,
    SessionErrorEvent,
    SessionJoinResponse,
    SessionPeerPresenceEvent,
    SessionSocketEventName,
    SessionTabBroadcastMessage,
    SessionTabChannelEvent,
} from "@/models/collaboration";

const COLLABORATION_API_BASE =
    import.meta.env.VITE_COLLABORATION_API_ENDPOINT ??
    "http://localhost:3003/v1/api";
const COLLABORATION_SOCKET_BASE =
    import.meta.env.VITE_COLLABORATION_SOCKET_ENDPOINT ??
    getOriginFromApiBase(COLLABORATION_API_BASE);
const QUESTION_API_BASE =
    import.meta.env.VITE_QUESTION_API_ENDPOINT ?? "http://localhost:3005/v1/api";

const starterCode = `function solve(input) {
  // Start coding with your partner.
  // Keep both explanation and implementation here.
  return input;
}`;

function pathSessionId(): string | null {
    const match = window.location.pathname.match(/^\/collaboration\/session\/([^/]+)$/);
    return match?.[1] ?? null;
}

function formatTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60)
        .toString()
        .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
}

function topicTitle(topic: string): string {
    return topic.trim().length > 0 ? topic : "Collaboration Session";
}

function formatExampleValue(value: unknown): string {
    if (typeof value === "string") {
        return value;
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function buildStubQuestionDetail(questionId: string): CollaborationQuestionDetail {
    const rawTokens = questionId.replace(/^stub-/, "").split("-").filter(Boolean);
    const difficultyToken = rawTokens.at(-1);
    const topicTokens =
        difficultyToken && ["easy", "medium", "hard"].includes(difficultyToken)
            ? rawTokens.slice(0, -1)
            : rawTokens;

    const topic = topicTokens.length
        ? topicTokens
              .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
              .join(" ")
        : "Collaboration";
    const difficulty =
        difficultyToken && ["easy", "medium", "hard"].includes(difficultyToken)
            ? difficultyToken.charAt(0).toUpperCase() + difficultyToken.slice(1)
            : "Medium";

    return {
        quid: questionId,
        title: `${topic} Practice Stub`,
        description:
            "This is a local stub problem for collaboration testing. Work with your partner to outline an approach, discuss tradeoffs, and implement a clean solution in the shared editor.",
        difficulty,
        topics: [topic],
        testCase: [
            {
                input: `[sample input for ${topic}]`,
                output: "[expected output]",
            },
            {
                input: "[edge case input]",
                output: "[edge case output]",
            },
        ],
    };
}

async function fetchQuestionDetail(
    questionId: string,
): Promise<CollaborationQuestionDetail | null> {
    if (questionId.startsWith("stub-")) {
        return buildStubQuestionDetail(questionId);
    }

    const response = await fetch(`${QUESTION_API_BASE}/questions/get`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ quid: questionId }),
    });

    const payload = (await response.json().catch(() => null)) as
        | {
              body?: Array<{
                  quid: string;
                  title: string;
                  description: string;
                  difficulty: string;
                  topics: string[];
                  test_case?: Array<{ input: unknown; output: unknown }>;
              }>;
          }
        | null;

    const question = payload?.body?.[0];
    if (!response.ok || !question) {
        return null;
    }

    return {
        quid: question.quid,
        title: question.title,
        description: question.description,
        difficulty: question.difficulty,
        topics: question.topics ?? [],
        testCase: (question.test_case ?? []).map((item) => ({
            input: formatExampleValue(item.input),
            output: formatExampleValue(item.output),
        })),
    };
}

function createActivityMessage(
    author: string,
    text: string,
    tone: ActivityTone,
): ActivityMessage {
    return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        author,
        text,
        tone,
    };
}

function statusToneClasses(status: ParticipantPresenceStatus): string {
    switch (status) {
        case ParticipantPresenceStatus.CONNECTED:
            return "bg-emerald-500/15 text-emerald-300";
        case ParticipantPresenceStatus.LEFT:
            return "bg-rose-500/15 text-rose-300";
        default:
            return "bg-amber-500/15 text-amber-300";
    }
}

function activityToneClasses(tone: ActivityTone): string {
    switch (tone) {
        case ActivityTone.PEER:
            return "border-sky-500/20 bg-sky-500/10";
        case ActivityTone.SYSTEM:
            return "border-amber-500/20 bg-amber-500/10";
        default:
            return "border-slate-700 bg-slate-800/80";
    }
}

export default function SessionRoom() {
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const socketRef = useRef<Socket | null>(null);
    const tabIdRef = useRef(`tab-${Math.random().toString(16).slice(2)}`);
    const sessionId = useMemo(() => pathSessionId(), []);
    const [sessionData, setSessionData] = useState<SessionJoinResponse | null>(null);
    const [questionDetail, setQuestionDetail] = useState<CollaborationQuestionDetail | null>(
        null,
    );
    const [presence, setPresence] = useState<ParticipantPresence[]>([]);
    const [code, setCode] = useState(starterCode);
    const [chatInput, setChatInput] = useState("");
    const [activity, setActivity] = useState<ActivityMessage[]>([]);
    const [connectionLabel, setConnectionLabel] = useState("connecting");
    const [error, setError] = useState<string | null>(null);
    const [timerSeconds, setTimerSeconds] = useState(24 * 60 + 35);
    const [showMultiTabPrompt, setShowMultiTabPrompt] = useState(false);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setTimerSeconds((current) => (current > 0 ? current - 1 : 0));
        }, 1000);

        return () => {
            window.clearInterval(timer);
        };
    }, []);

    useEffect(() => {
        if (!isLoaded) {
            return;
        }

        if (!isSignedIn) {
            window.location.replace("/account/login");
        }
    }, [isLoaded, isSignedIn]);

    useEffect(() => {
        if (!isLoaded || !isSignedIn || !sessionId) {
            return;
        }

        let isCancelled = false;

        const appendActivity = (message: ActivityMessage) => {
            setActivity((current) => [...current, message]);
        };

        void (async () => {
            try {
                const joinResponse = await apiFetch(`/sessions/${sessionId}/join`, {
                    method: "POST",
                    baseUrl: COLLABORATION_API_BASE,
                });

                const joinPayload = (await joinResponse.json().catch(() => null)) as
                    | SessionJoinResponse
                    | { message?: string }
                    | null;

                if (!joinResponse.ok || !joinPayload || !("session" in joinPayload)) {
                    throw new Error(
                        joinPayload?.message ??
                            "Unable to join the collaboration session.",
                    );
                }

                if (isCancelled) {
                    return;
                }

                setSessionData(joinPayload);
                setPresence(joinPayload.participants);
                const resolvedQuestion = await fetchQuestionDetail(
                    joinPayload.session.questionId,
                );
                if (!isCancelled) {
                    setQuestionDetail(resolvedQuestion);
                }
                appendActivity(
                    createActivityMessage(
                        "You",
                        "Joined the session automatically after a successful match.",
                        ActivityTone.YOU,
                    ),
                );
                pushToast({
                    tone: "success",
                    message: "Matched successfully. Joining your collaboration session.",
                });

                const token = await getToken({ template: "jwt" });
                if (!token) {
                    throw new Error("Authentication token is missing.");
                }

                const socket = io(COLLABORATION_SOCKET_BASE, {
                    transports: ["websocket"],
                    auth: {
                        authorization: `Bearer ${token}`,
                    },
                });

                socketRef.current = socket;

                socket.on("connect", () => {
                    setConnectionLabel("active");
                    socket.emit(SessionSocketEventName.SESSION_JOIN, { sessionId });
                });

                socket.on("disconnect", () => {
                    setConnectionLabel("disconnected");
                    pushToast({
                        tone: "error",
                        message: "Realtime connection lost. Trying to recover session presence.",
                    });
                });

                socket.on(SessionSocketEventName.SESSION_JOINED, (payload: SessionJoinResponse) => {
                    setSessionData(payload);
                    setPresence(payload.participants);
                    void fetchQuestionDetail(payload.session.questionId).then((resolvedQuestion) => {
                        setQuestionDetail(resolvedQuestion);
                    });
                });

                socket.on(
                    SessionSocketEventName.SESSION_PEER_JOINED,
                    (payload: SessionPeerPresenceEvent) => {
                        setPresence(payload.participants);
                        appendActivity(
                            createActivityMessage(
                                "Peer",
                                `${payload.userId} joined the session.`,
                                ActivityTone.PEER,
                            ),
                        );
                        pushToast({
                            tone: "success",
                            message: `${payload.userId} joined the session.`,
                        });
                    },
                );

                socket.on(
                    SessionSocketEventName.SESSION_PEER_DISCONNECTED,
                    (payload: SessionPeerPresenceEvent) => {
                        setPresence(payload.participants);
                        appendActivity(
                            createActivityMessage(
                                "System",
                                `${payload.userId} disconnected unexpectedly.`,
                                ActivityTone.SYSTEM,
                            ),
                        );
                        pushToast({
                            tone: "error",
                            message: `${payload.userId} disconnected unexpectedly.`,
                        });
                    },
                );

                socket.on(
                    SessionSocketEventName.SESSION_PEER_LEFT,
                    (payload: SessionPeerPresenceEvent) => {
                        setPresence(payload.participants);
                        appendActivity(
                            createActivityMessage(
                                "System",
                                `${payload.userId} left the session.`,
                                ActivityTone.SYSTEM,
                            ),
                        );
                        pushToast({
                            tone: "info",
                            message: `${payload.userId} left the session.`,
                        });
                    },
                );

                socket.on(SessionSocketEventName.SESSION_ERROR, (payload: SessionErrorEvent) => {
                    const message = payload.message ?? "Unexpected collaboration error.";
                    setError(message);
                    pushToast({
                        tone: "error",
                        message,
                    });
                });
            } catch (joinError) {
                if (isCancelled) {
                    return;
                }

                const message =
                    joinError instanceof Error
                        ? joinError.message
                        : "Unable to load the collaboration workspace.";
                setError(message);
                pushToast({
                    tone: "error",
                    message,
                });
            }
        })();

        return () => {
            isCancelled = true;

            if (socketRef.current) {
                socketRef.current.emit(SessionSocketEventName.SESSION_LEAVE, { sessionId });
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [getToken, isLoaded, isSignedIn, sessionId]);

    useEffect(() => {
        if (!sessionId || typeof BroadcastChannel === "undefined") {
            return;
        }

        const channel = new BroadcastChannel("peerprep-collaboration-tabs");

        const handleMessage = (event: MessageEvent<SessionTabBroadcastMessage>) => {
            const payload = event.data;
            if (
                !payload ||
                payload.sessionId !== sessionId ||
                payload.tabId === tabIdRef.current
            ) {
                return;
            }

            if (payload.type === SessionTabChannelEvent.TAB_OPENED) {
                setShowMultiTabPrompt(true);
            }
        };

        channel.addEventListener("message", handleMessage);
        channel.postMessage({
            type: SessionTabChannelEvent.TAB_OPENED,
            sessionId,
            tabId: tabIdRef.current,
        } satisfies SessionTabBroadcastMessage);

        return () => {
            channel.postMessage({
                type: SessionTabChannelEvent.TAB_CLOSED,
                sessionId,
                tabId: tabIdRef.current,
            } satisfies SessionTabBroadcastMessage);
            channel.removeEventListener("message", handleMessage);
            channel.close();
        };
    }, [sessionId]);

    const participantSummary = presence.map((participant) => ({
        ...participant,
        label:
            sessionData?.currentUserId === participant.userId
                ? "You"
                : participant.userId,
    }));

    const handleSendChat = () => {
        const message = chatInput.trim();
        if (!message) {
            return;
        }

        setActivity((current) => [
            ...current,
            createActivityMessage("You", message, ActivityTone.YOU),
        ]);
        setChatInput("");
    };

    const handleRunCode = () => {
        pushToast({
            tone: "success",
            message: "Run Code is ready for backend execution wiring.",
        });
    };

    const handleExitSession = () => {
        if (socketRef.current && sessionId) {
            socketRef.current.emit(SessionSocketEventName.SESSION_LEAVE, { sessionId });
            socketRef.current.disconnect();
        }

        pushToast({
            tone: "info",
            message: "Leaving the collaboration session.",
        });
        window.location.replace("/account/profile");
    };

    if (!isLoaded || !isSignedIn) {
        return null;
    }

    if (!sessionId) {
        return (
            <section className="app-shell">
                <p>Missing collaboration session id.</p>
            </section>
        );
    }

    if (error) {
        return (
            <section className="app-shell">
                <p>{error}</p>
                <div className="link-row">
                    <a href="/account/profile">Return to profile</a>
                </div>
            </section>
        );
    }

    return (
        <section className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_22%),linear-gradient(180deg,#111827_0%,#0f172a_100%)] text-slate-100">
            {showMultiTabPrompt ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
                    <Card className="w-full max-w-lg border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
                        <CardHeader>
                            <CardTitle className="text-xl">
                                Another Tab Detected
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <p className="text-base leading-7 text-slate-300">
                                This session is also open in another tab. Do you want to stay here or leave?
                            </p>
                            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700 hover:text-slate-100"
                                    onClick={() => setShowMultiTabPrompt(false)}
                                >
                                    Stay Here
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={handleExitSession}
                                >
                                    Leave
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : null}
            <header className="flex flex-col gap-4 border-b border-slate-700/60 bg-slate-900/95 px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-7">
                <div className="flex items-start gap-4 lg:items-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-500 text-lg font-bold shadow-lg">
                        {"</>"}
                    </div>
                    <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-4">
                        <span className="text-3xl font-bold tracking-tight">Peer2Prep</span>
                        <span className="hidden h-8 w-px bg-slate-700 lg:block" />
                        <span className="text-lg font-semibold text-slate-400 lg:text-xl">
                            {topicTitle(sessionData?.session.topic ?? "Loading session")}
                        </span>
                    </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                    <Card className="border-slate-700/70 bg-slate-700/50 px-5 py-3 text-center">
                        <span className="text-3xl font-bold tracking-wide">
                            {formatTime(timerSeconds)}
                        </span>
                    </Card>
                    <Button
                        type="button"
                        variant="destructive"
                        className="h-14 rounded-2xl px-8 text-base font-semibold"
                        onClick={handleExitSession}
                    >
                        Exit Session
                    </Button>
                </div>
            </header>

            <div className="grid min-h-[calc(100vh-92px)] grid-cols-1 lg:grid-cols-[minmax(0,45%)_minmax(0,55%)]">
                <aside className="border-r border-slate-700/60 bg-slate-950/60 p-5 lg:p-7">
                    <div className="mb-6 flex flex-wrap gap-3">
                        <span className="rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-300">
                            {questionDetail?.difficulty ?? sessionData?.session.difficulty ?? "Medium"}
                        </span>
                        <span className="rounded-full bg-slate-700/80 px-4 py-2 text-sm font-bold text-slate-100">
                            {questionDetail?.topics?.[0] ?? sessionData?.session.topic ?? "Topic"}
                        </span>
                        <span className="rounded-full bg-slate-700/80 px-4 py-2 text-sm font-bold text-slate-100">
                            Question #{sessionData?.session.questionId ?? "--"}
                        </span>
                    </div>

                    <h1 className="mb-8 text-4xl font-extrabold tracking-tight">
                        1. {questionDetail?.title ?? topicTitle(sessionData?.session.topic ?? "Collaboration Session")}
                    </h1>

                    <section className="mb-8 space-y-4">
                        <h2 className="text-3xl font-bold">Description</h2>
                        <p className="text-lg leading-8 text-slate-300">
                            {questionDetail?.description ??
                                "You and your partner were matched successfully and joined this session automatically. Use the shared editor and chat to reason through the problem together without leaving the workspace."}
                        </p>
                        <p className="text-lg leading-8 text-slate-300">
                            Language:
                            <span className="ml-2 rounded-lg bg-slate-800 px-3 py-1 font-semibold text-sky-300">
                                {sessionData?.session.language ?? "JavaScript"}
                            </span>
                        </p>
                    </section>

                    <section className="mb-8 space-y-4">
                        <h2 className="text-3xl font-bold">Examples</h2>
                        <div className="space-y-4">
                            {(questionDetail?.testCase.length
                                ? questionDetail.testCase.slice(0, 3).map((example, index) => ({
                                      title: `Example ${index + 1}`,
                                      input: example.input,
                                      output: example.output,
                                  }))
                                : []).map((example) => (
                                <Card
                                    key={example.title}
                                    className="border-slate-700/70 bg-slate-800/80 text-slate-100"
                                >
                                    <CardHeader>
                                        <CardTitle className="text-xl">{example.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 font-mono text-sm leading-7 text-slate-300">
                                        <p>
                                            <span className="font-semibold text-slate-100">Input:</span>{" "}
                                            {example.input}
                                        </p>
                                        <p>
                                            <span className="font-semibold text-slate-100">Output:</span>{" "}
                                            {example.output}
                                        </p>
                                    </CardContent>
                                </Card>
                            ))}
                            {!questionDetail?.testCase.length ? (
                                <Card className="border-slate-700/70 bg-slate-800/80 text-slate-100">
                                    <CardContent className="py-6 text-sm leading-7 text-slate-300">
                                        Question examples will appear here once the question service
                                        returns test cases for this session.
                                    </CardContent>
                                </Card>
                            ) : null}
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-3xl font-bold">Session Presence</h2>
                        <div className="space-y-3">
                            {participantSummary.map((participant) => (
                                <Card
                                    key={participant.userId}
                                    className="border-slate-700/70 bg-slate-800/80 px-4 py-4"
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="text-base font-semibold text-slate-100">
                                            {participant.label}
                                        </span>
                                        <span
                                            className={`rounded-full px-3 py-1 text-sm font-bold capitalize ${statusToneClasses(participant.status)}`}
                                        >
                                            {participant.status}
                                        </span>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </section>
                </aside>

                <section className="grid min-h-[70vh] grid-rows-[auto_1fr_22rem] bg-slate-950">
                    <div className="flex flex-col gap-4 border-b border-slate-700/60 bg-slate-800/90 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <Label htmlFor="language" className="sr-only">
                                Language
                            </Label>
                            <select
                                id="language"
                                className="h-11 rounded-xl border border-slate-600 bg-slate-700 px-4 text-base text-slate-100 shadow-sm"
                                value={sessionData?.session.language ?? "JavaScript"}
                                onChange={() => undefined}
                            >
                                <option>{sessionData?.session.language ?? "JavaScript"}</option>
                            </select>
                            <div className="flex items-center gap-3 text-base font-semibold text-slate-300">
                                <span
                                    className={`h-3 w-3 rounded-full ${
                                        connectionLabel === "active"
                                            ? "bg-emerald-400"
                                            : connectionLabel === "connecting"
                                              ? "bg-amber-400"
                                              : "bg-rose-400"
                                    }`}
                                />
                                <span className="capitalize">{connectionLabel}</span>
                            </div>
                        </div>
                        <Button
                            type="button"
                            className="h-11 rounded-xl bg-emerald-600 px-6 text-base font-semibold hover:bg-emerald-500"
                            onClick={handleRunCode}
                        >
                            Run Code
                        </Button>
                    </div>

                    <div className="bg-black">
                        <textarea
                            className="h-full min-h-[28rem] w-full resize-none border-0 bg-black px-6 py-5 font-mono text-base leading-8 text-slate-200 outline-none"
                            value={code}
                            onChange={(event) => setCode(event.target.value)}
                            spellCheck={false}
                        />
                    </div>

                    <div className="grid grid-rows-[auto_1fr_auto] border-t border-slate-700/60 bg-slate-900/95">
                        <div className="border-b border-slate-700/60 px-5 py-4 text-2xl font-bold">
                            Chat
                        </div>
                        <div className="space-y-3 overflow-y-auto px-5 py-4">
                            {activity.map((message) => (
                                <Card
                                    key={message.id}
                                    className={`border px-4 py-3 ${activityToneClasses(message.tone)}`}
                                >
                                    <strong className="mb-1 block text-sm font-semibold text-slate-100">
                                        {message.author}
                                    </strong>
                                    <p className="text-sm leading-6 text-slate-200">
                                        {message.text}
                                    </p>
                                </Card>
                            ))}
                        </div>
                        <div className="grid gap-3 border-t border-slate-700/60 px-5 py-4 sm:grid-cols-[1fr_auto]">
                            <Input
                                value={chatInput}
                                onChange={(event) => setChatInput(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        handleSendChat();
                                    }
                                }}
                                placeholder="Type a message..."
                                className="h-12 rounded-xl border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-400"
                            />
                            <Button
                                type="button"
                                className="h-12 rounded-xl px-6 text-base font-semibold"
                                onClick={handleSendChat}
                            >
                                Send
                            </Button>
                        </div>
                    </div>
                </section>
            </div>
        </section>
    );
}
