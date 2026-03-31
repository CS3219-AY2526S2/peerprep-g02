import { startTransition, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
    ArrowLeftRight,
    CheckCircle2,
    Clock3,
    Code2,
    LoaderCircle,
    LogOut,
    MessageSquareText,
    Play,
    Radio,
    Send,
    TerminalSquare,
    UsersRound,
    Wifi,
    WifiOff,
    XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

import { useCollaborationSession } from "@/services/collaboration/useCollaborationSession";

function formatElapsed(createdAt: string | undefined, now: number): string {
    if (!createdAt) {
        return "00:00";
    }

    const startedAt = new Date(createdAt).getTime();
    if (Number.isNaN(startedAt)) {
        return "00:00";
    }

    const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
}

function getInitials(userId: string): string {
    return userId.slice(0, 2).toUpperCase();
}

function getEditorPlaceholder(language: string): string {
    const placeholders: Record<string, string> = {
        javascript: "// Start coding in JavaScript...",
        typescript: "// Start coding in TypeScript...",
        python: "# Start coding in Python...",
        java: "// Start coding in Java...",
        cpp: "// Start coding in C++...",
        c: "// Start coding in C...",
        go: "// Start coding in Go...",
        rust: "// Start coding in Rust...",
    };
    return placeholders[language.toLowerCase()] ?? "// Start collaborating here...";
}

export default function CollaborationSessionView() {
    const { collaborationId } = useParams<{ collaborationId: string }>();
    const navigate = useNavigate();
    const [now, setNow] = useState(() => Date.now());
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const {
        connectionState,
        joinState,
        question,
        editorValue,
        setEditorValue,
        participants,
        joinError,
        partnerNotification,
        leaveSession,
        executionOutput,
        language,
        offlineChanges,
        submitOfflineChanges,
        discardOfflineChanges,
        sessionEnded,
        runCode,
        submitCode,
        isExecuting,
        executionResults,
        submissionResult,
    } = useCollaborationSession(collaborationId);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    // Auto-redirect home after successful submission
    useEffect(() => {
        if (!submissionResult?.success) return;
        const timeout = setTimeout(() => {
            void leaveSession().then(() => {
                startTransition(() => navigate(ROUTES.DASHBOARD));
            });
        }, 3000);
        return () => clearTimeout(timeout);
    }, [submissionResult, leaveSession, navigate]);

    const session = joinState?.session;
    const elapsed = formatElapsed(session?.createdAt, now);
    const testRows = useMemo(
        () =>
            (question?.testCase ?? []).map((testCase, index) => {
                const result = executionResults?.results.find((r) => r.testCaseIndex === index);
                return {
                    id: index + 1,
                    input:
                        Array.isArray(testCase.input) && testCase.input.length === 1
                            ? typeof testCase.input[0] === "string"
                                ? testCase.input[0]
                                : JSON.stringify(testCase.input[0])
                            : typeof testCase.input === "string"
                              ? testCase.input
                              : JSON.stringify(testCase.input),
                    expectedOutput:
                        typeof testCase.output === "string"
                            ? testCase.output
                            : JSON.stringify(testCase.output),
                    actualOutput: result?.actualOutput ?? "-",
                    status: result ? (result.passed ? "passed" : "failed") : "pending",
                    error: result?.error,
                };
            }),
        [question?.testCase, executionResults],
    );

    const connectionBadge =
        connectionState === "connected" ? (
            <Badge variant="success" className="gap-1.5 rounded-full px-3 py-1 text-sm">
                <Wifi className="size-3.5" />
                Active
            </Badge>
        ) : connectionState === "reconnecting" ? (
            <Badge variant="warning" className="gap-1.5 rounded-full px-3 py-1 text-sm">
                <LoaderCircle className="size-3.5 animate-spin" />
                Reconnecting
            </Badge>
        ) : (
            <Badge variant="destructive" className="gap-1.5 rounded-full px-3 py-1 text-sm">
                <WifiOff className="size-3.5" />
                Disconnected
            </Badge>
        );

    return (
        <div className="min-h-screen bg-[#0b1120] text-slate-100">
            <div className="border-b border-white/10 bg-[#101827]/95 px-4 py-4 shadow-[0_12px_45px_rgba(0,0,0,0.35)] backdrop-blur">
                <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-4">
                        <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-900/50">
                            <Code2 className="size-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl font-bold tracking-tight text-white">
                                    PeerPrep
                                </span>
                                <span className="hidden text-slate-500 md:inline">|</span>
                                <span className="truncate text-lg font-semibold text-slate-300">
                                    {question?.title ?? session?.topic ?? "Collaboration Session"}
                                </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-400">
                                {session
                                    ? `Session ${session.collaborationId}`
                                    : "Connecting to collaboration session"}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-lg font-semibold text-slate-100">
                            <Clock3 className="size-5 text-blue-300" />
                            {elapsed}
                        </div>
                        <Button
                            variant="destructive"
                            size="lg"
                            className="rounded-2xl bg-red-500 px-5 text-white hover:bg-red-400"
                            onClick={() => setShowLeaveConfirm(true)}
                        >
                            <LogOut className="size-4" />
                            Exit Session
                        </Button>
                    </div>
                </div>
            </div>

            <main className="mx-auto grid min-h-[calc(100vh-92px)] max-w-[1800px] gap-0 lg:grid-cols-[minmax(380px,0.95fr)_minmax(520px,1.2fr)]">
                <section className="border-b border-white/10 bg-[#0f172a] p-5 lg:border-r lg:border-b-0">
                    <div className="space-y-5">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="success" className="rounded-full px-4 py-1 text-sm">
                                {question?.difficulty ?? session?.difficulty ?? "Unknown"}
                            </Badge>
                            {(question?.topics ?? [session?.topic].filter(Boolean)).map((topic) => (
                                <Badge
                                    key={topic}
                                    variant="outline"
                                    className="rounded-full border-white/10 bg-white/5 px-4 py-1 text-sm text-slate-300"
                                >
                                    {topic}
                                </Badge>
                            ))}
                        </div>

                        <div className="space-y-3">
                            <h1 className="text-4xl font-bold tracking-tight text-white">
                                {question?.title ?? "Loading problem..."}
                            </h1>
                            <div className="flex flex-wrap items-center gap-3">
                                {connectionBadge}
                                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
                                    <UsersRound className="size-4 text-cyan-300" />
                                    {
                                        participants.filter(
                                            (participant) => participant.status === "connected",
                                        ).length
                                    }
                                    /2 present
                                </div>
                                {partnerNotification && (
                                    <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-sm text-blue-300">
                                        {partnerNotification}
                                    </div>
                                )}
                            </div>
                        </div>

                        {joinError ? (
                            <Card className="border-red-500/30 bg-red-500/10 py-0 text-red-50 ring-1 ring-red-500/20">
                                <CardContent className="p-5">
                                    <p className="font-semibold">Unable to join session</p>
                                    <p className="mt-2 text-sm text-red-100/80">{joinError}</p>
                                    <div className="mt-4">
                                        <Button
                                            asChild
                                            variant="outline"
                                            className="border-white/20 bg-transparent text-white hover:bg-white/10"
                                        >
                                            <Link to={ROUTES.DASHBOARD}>Back to dashboard</Link>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : null}

                        <Card className="border border-white/10 bg-white/[0.03] py-0 shadow-none ring-0">
                            <CardHeader className="px-6 pt-6">
                                <CardTitle className="text-2xl font-semibold text-white">
                                    Description
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 px-6 pb-6 text-lg leading-8 text-slate-300">
                                {(question?.description ?? "Joining session and loading prompt...")
                                    .split(/\n+/)
                                    .filter(Boolean)
                                    .map((paragraph, index) => (
                                        <p key={`${index}-${paragraph.slice(0, 16)}`}>
                                            {paragraph}
                                        </p>
                                    ))}
                            </CardContent>
                        </Card>

                        <div className="space-y-4">
                            <h2 className="text-2xl font-semibold text-white">Examples</h2>
                            {testRows.length > 0 ? (
                                testRows.map((testRow) => (
                                    <Card
                                        key={testRow.id}
                                        className="border border-white/10 bg-white/[0.03] py-0 shadow-none ring-0"
                                    >
                                        <CardContent className="space-y-3 px-6 py-5 text-base text-slate-300">
                                            <p className="text-lg font-semibold text-white">
                                                Example {testRow.id}
                                            </p>
                                            <p>
                                                <span className="font-semibold text-slate-200">
                                                    Input:
                                                </span>{" "}
                                                {testRow.input}
                                            </p>
                                            <p>
                                                <span className="font-semibold text-slate-200">
                                                    Output:
                                                </span>{" "}
                                                {testRow.expectedOutput}
                                            </p>
                                        </CardContent>
                                    </Card>
                                ))
                            ) : (
                                <Card className="border border-dashed border-white/10 bg-white/[0.02] py-0 shadow-none ring-0">
                                    <CardContent className="px-6 py-5 text-slate-400">
                                        Example cases will appear here once the problem details are
                                        loaded.
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </section>

                <section className="flex min-h-[calc(100vh-92px)] flex-col bg-[#111827]">
                    <div className="border-b border-white/10 px-5 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-lg font-medium text-slate-100">
                                    {language || session?.language || "Language"}
                                </div>
                                {connectionBadge}
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    size="lg"
                                    className="rounded-2xl bg-emerald-500 px-5 text-white hover:bg-emerald-400"
                                    disabled={isExecuting || !!sessionEnded}
                                    onClick={() => void runCode()}
                                >
                                    {isExecuting ? (
                                        <LoaderCircle className="size-4 animate-spin" />
                                    ) : (
                                        <Play className="size-4" />
                                    )}
                                    Run Code
                                </Button>
                                <Button
                                    size="lg"
                                    className="rounded-2xl bg-blue-500 px-5 text-white hover:bg-blue-400"
                                    disabled={isExecuting || !!sessionEnded}
                                    onClick={() => void submitCode()}
                                >
                                    {isExecuting ? (
                                        <LoaderCircle className="size-4 animate-spin" />
                                    ) : (
                                        <Send className="size-4" />
                                    )}
                                    Submit Solution
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="grid flex-1 lg:grid-rows-[minmax(0,1.4fr)_minmax(280px,0.95fr)]">
                        {/* F4.8 & F4.9 - Session ended banner */}
                        {sessionEnded && (
                            <div className="flex items-center justify-between border-b border-red-500/30 bg-red-500/10 px-5 py-4">
                                <div className="flex items-center gap-3">
                                    <XCircle className="size-5 text-red-400" />
                                    <span className="font-medium text-red-300">
                                        {sessionEnded.reason === "both_users_left"
                                            ? "Session ended - both users have left"
                                            : sessionEnded.reason === "inactivity_timeout"
                                              ? "Session ended due to inactivity"
                                              : "Session has ended"}
                                    </span>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-red-500/50 bg-transparent text-red-300 hover:bg-red-500/20"
                                    onClick={() => {
                                        startTransition(() => navigate(ROUTES.DASHBOARD));
                                    }}
                                >
                                    Return to Dashboard
                                </Button>
                            </div>
                        )}

                        {/* Submission result banner */}
                        {submissionResult && (
                            <div
                                className={cn(
                                    "flex items-center justify-between border-b px-5 py-4",
                                    submissionResult.success
                                        ? "border-emerald-500/30 bg-emerald-500/10"
                                        : "border-amber-500/30 bg-amber-500/10",
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    {submissionResult.success ? (
                                        <CheckCircle2 className="size-5 text-emerald-400" />
                                    ) : (
                                        <XCircle className="size-5 text-amber-400" />
                                    )}
                                    <span
                                        className={cn(
                                            "font-medium",
                                            submissionResult.success
                                                ? "text-emerald-300"
                                                : "text-amber-300",
                                        )}
                                    >
                                        Solution submitted! {submissionResult.testCasesPassed}/
                                        {submissionResult.totalTestCases} test cases passed.
                                    </span>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className={cn(
                                        "bg-transparent",
                                        submissionResult.success
                                            ? "border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/20"
                                            : "border-amber-500/50 text-amber-300 hover:bg-amber-500/20",
                                    )}
                                    onClick={() => {
                                        void leaveSession().then(() => {
                                            startTransition(() => navigate(ROUTES.DASHBOARD));
                                        });
                                    }}
                                >
                                    Return Home
                                </Button>
                            </div>
                        )}

                        {/* F4.7.4 & F4.7.5 - Offline changes banner */}
                        {offlineChanges && !sessionEnded && (
                            <div className="flex items-center justify-between border-b border-amber-500/30 bg-amber-500/10 px-5 py-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-amber-300">
                                        You have unsaved changes from when you were offline
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-amber-500/50 bg-transparent text-amber-300 hover:bg-amber-500/20"
                                        onClick={submitOfflineChanges}
                                    >
                                        Submit Changes
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-slate-400 hover:text-slate-200"
                                        onClick={discardOfflineChanges}
                                    >
                                        Discard
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="border-b border-white/10 bg-black">
                            <Textarea
                                value={editorValue}
                                onChange={(event) => setEditorValue(event.target.value)}
                                placeholder={getEditorPlaceholder(language)}
                                disabled={!!sessionEnded}
                                className="h-full min-h-[360px] resize-none rounded-none border-0 bg-black px-6 py-5 font-mono text-base leading-7 text-slate-100 shadow-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>

                        <div className="grid min-h-[320px] lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.75fr)]">
                            <div className="border-b border-white/10 lg:border-r lg:border-b-0">
                                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                                    <div className="flex items-center gap-3">
                                        <TerminalSquare className="size-5 text-cyan-300" />
                                        <h2 className="text-2xl font-semibold text-white">
                                            Test Cases
                                        </h2>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-400">
                                        <Radio className="size-4 text-emerald-400" />
                                        {executionOutput
                                            ? "Output received"
                                            : "Execution shell ready"}
                                    </div>
                                </div>

                                {executionResults && (
                                    <div className="border-b border-white/10 bg-black/50 px-5 py-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-slate-400">
                                                Results
                                            </span>
                                            <span
                                                className={cn(
                                                    "text-sm font-semibold",
                                                    executionResults.testCasesPassed ===
                                                        executionResults.totalTestCases &&
                                                        executionResults.totalTestCases > 0
                                                        ? "text-emerald-400"
                                                        : "text-amber-400",
                                                )}
                                            >
                                                {executionResults.testCasesPassed}/
                                                {executionResults.totalTestCases} passed
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {executionResults?.stderr && (
                                    <div className="border-b border-white/10 bg-red-500/5 p-4">
                                        <p className="mb-2 text-sm font-medium text-red-400">
                                            Stderr:
                                        </p>
                                        <pre className="whitespace-pre-wrap font-mono text-sm text-red-300">
                                            {executionResults.stderr}
                                        </pre>
                                    </div>
                                )}

                                <div className="overflow-auto">
                                    <table className="min-w-full text-left text-sm">
                                        <thead className="bg-white/[0.03] text-slate-400">
                                            <tr>
                                                <th className="px-5 py-3 font-medium">Case</th>
                                                <th className="px-5 py-3 font-medium">Input</th>
                                                <th className="px-5 py-3 font-medium">Output</th>
                                                <th className="px-5 py-3 font-medium">Expected</th>
                                                <th className="px-5 py-3 font-medium">Result</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {testRows.length > 0 ? (
                                                testRows.map((testRow) => (
                                                    <tr
                                                        key={testRow.id}
                                                        className="border-t border-white/5 text-slate-200"
                                                    >
                                                        <td className="px-5 py-4">{testRow.id}</td>
                                                        <td className="max-w-[150px] truncate px-5 py-4 font-mono text-xs">
                                                            {testRow.input}
                                                        </td>
                                                        <td className="max-w-[150px] px-5 py-4 font-mono text-xs">
                                                            <span className="block truncate">
                                                                {testRow.actualOutput ||
                                                                    (testRow.error ? "" : "-")}
                                                            </span>
                                                            {testRow.error && (
                                                                <span className="block truncate text-red-400">
                                                                    {testRow.error}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="max-w-[150px] truncate px-5 py-4 font-mono text-xs">
                                                            {testRow.expectedOutput}
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <span
                                                                className={cn(
                                                                    "inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold",
                                                                    testRow.status === "passed"
                                                                        ? "bg-emerald-500/15 text-emerald-300"
                                                                        : testRow.status ===
                                                                            "failed"
                                                                          ? "bg-red-500/15 text-red-300"
                                                                          : "bg-slate-500/15 text-slate-400",
                                                                )}
                                                            >
                                                                {testRow.status === "passed" ? (
                                                                    <CheckCircle2 className="size-4" />
                                                                ) : testRow.status === "failed" ? (
                                                                    <XCircle className="size-4" />
                                                                ) : null}
                                                                {testRow.status === "passed"
                                                                    ? "Passed"
                                                                    : testRow.status === "failed"
                                                                      ? "Failed"
                                                                      : "Pending"}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td
                                                        colSpan={5}
                                                        className="px-5 py-10 text-center text-slate-500"
                                                    >
                                                        No test cases loaded yet.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex min-h-[320px] flex-col">
                                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                                    <div className="flex items-center gap-3">
                                        <MessageSquareText className="size-5 text-blue-300" />
                                        <h2 className="text-2xl font-semibold text-white">Chat</h2>
                                    </div>
                                    <p className="text-sm text-slate-400">
                                        Live collaboration shell
                                    </p>
                                </div>

                                <div className="flex-1 space-y-4 overflow-auto px-5 py-5">
                                    {participants.map((participant) => (
                                        <div
                                            key={participant.userId}
                                            className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3"
                                        >
                                            <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-sm font-bold text-slate-950">
                                                {getInitials(participant.userId)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="truncate font-semibold text-white">
                                                        {participant.userId}
                                                    </p>
                                                    <Badge
                                                        variant={
                                                            participant.status === "connected"
                                                                ? "success"
                                                                : participant.status ===
                                                                    "disconnected"
                                                                  ? "warning"
                                                                  : "destructive"
                                                        }
                                                        className="rounded-full"
                                                    >
                                                        {participant.status}
                                                    </Badge>
                                                </div>
                                                <p className="mt-1 text-sm text-slate-400">
                                                    {participant.connectionCount} active connection
                                                    {participant.connectionCount === 1 ? "" : "s"}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="border-t border-white/10 px-5 py-4">
                                    <div className="flex items-end gap-3">
                                        <Textarea
                                            disabled
                                            placeholder="Chat messaging will plug into the collaboration socket next."
                                            className="min-h-20 border-white/10 bg-white/[0.03] text-slate-100 placeholder:text-slate-500"
                                        />
                                        <Button
                                            size="icon-lg"
                                            className="rounded-2xl bg-blue-500 text-white hover:bg-blue-400"
                                            disabled
                                        >
                                            <ArrowLeftRight className="size-4 rotate-45" />
                                        </Button>
                                    </div>
                                    <CardDescription className="mt-3 text-slate-500">
                                        Messaging UI is ready; live chat transport will be wired in
                                        the next realtime step.
                                    </CardDescription>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Leave session confirmation dialog */}
            {showLeaveConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <Card className="w-full max-w-md rounded-[24px] border border-white/10 bg-[#1e293b] p-0 shadow-2xl">
                        <CardContent className="p-8">
                            <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-red-500/15">
                                <LogOut className="size-7 text-red-400" />
                            </div>
                            <CardTitle className="mb-2 text-2xl font-bold text-white">
                                Leave Session?
                            </CardTitle>
                            <CardDescription className="text-base text-slate-400">
                                Are you sure you want to leave this collaboration session? You will
                                not be able to rejoin once you leave.
                            </CardDescription>
                            <div className="mt-8 flex items-center justify-end gap-3">
                                <Button
                                    variant="ghost"
                                    size="lg"
                                    className="rounded-2xl px-6 text-slate-300 hover:bg-white/10 hover:text-white"
                                    onClick={() => setShowLeaveConfirm(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="lg"
                                    className="rounded-2xl bg-red-500 px-6 text-white hover:bg-red-400"
                                    onClick={() => {
                                        setShowLeaveConfirm(false);
                                        void leaveSession().then(() => {
                                            startTransition(() => navigate(ROUTES.DASHBOARD));
                                        });
                                    }}
                                >
                                    Leave Session
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
