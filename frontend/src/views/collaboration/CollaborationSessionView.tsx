import { startTransition, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "@clerk/clerk-react";
import { LoaderCircle, UsersRound, Wifi, WifiOff } from "lucide-react";
import { type UUID } from "node:crypto";

import AiHintsPanel from "@/components/collaboration/AiHintsPanel";
import CodeEditor from "@/components/collaboration/CodeEditor";
import EditorToolbar from "@/components/collaboration/EditorToolbar";
import ExamplesSection from "@/components/collaboration/ExamplesSection";
import LeaveSessionDialog from "@/components/collaboration/LeaveSessionDialog";
import ParticipantsPanel from "@/components/collaboration/ParticipantsPanel";
import ProblemDescription from "@/components/collaboration/ProblemDescription";
import SessionHeader from "@/components/collaboration/SessionHeader";
import StatusBanners from "@/components/collaboration/StatusBanners";
import { SubmissionResultDialog } from "@/components/collaboration/SubmissionResultDialog";
import TestCasesPanel, { type TestRow } from "@/components/collaboration/TestCasesPanel";
import LiveChat from "@/components/message/LiveChat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { ROUTES } from "@/constants/routes";

import { useTopics } from "@/context/useTopic";
import { useCollaborationSession } from "@/services/collaboration/useCollaborationSession";

function formatElapsed(createdAt: string | undefined, now: number): string {
    if (!createdAt) return "00:00";
    const startedAt = new Date(createdAt).getTime();
    if (Number.isNaN(startedAt)) return "00:00";
    const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
}

export default function CollaborationSessionView() {
    const { collaborationId } = useParams<{ collaborationId: string }>();
    const navigate = useNavigate();
    const { userId: currentUserId } = useAuth();
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
        hints,
        isHintLoading,
        hintsRemaining,
        requestHint,
        userNames,
    } = useCollaborationSession(collaborationId);

    const { topics: topicMap } = useTopics();
    const session = joinState?.session;
    const elapsed = formatElapsed(session?.createdAt, now);

    const getDisplayName = (userId: string) =>
        userNames[userId] ?? (userId === currentUserId ? "You" : "Partner");

    // Tick the elapsed timer
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    // Auto-redirect home after submission (pass or fail)
    useEffect(() => {
        if (!submissionResult) return;
        const timeout = setTimeout(() => {
            void leaveSession().then(() => {
                startTransition(() => navigate(ROUTES.DASHBOARD));
            });
        }, 5000);
        return () => clearTimeout(timeout);
    }, [submissionResult, leaveSession, navigate]);

    const testRows = useMemo<TestRow[]>(
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
                    status: result ? (result.passed ? "passed" : "failed") : ("pending" as const),
                    error: result?.error,
                };
            }),
        [question?.testCase, executionResults],
    );

    const handleReturnToDashboard = () => startTransition(() => navigate(ROUTES.DASHBOARD));
    const handleReturnHome = () => {
        void leaveSession().then(() => startTransition(() => navigate(ROUTES.DASHBOARD)));
    };

    const actionDisabled = isExecuting || !!sessionEnded || connectionState !== "connected";

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
            <SessionHeader
                title={question?.title ?? session?.topic ?? "Collaboration Session"}
                elapsed={elapsed}
                onExitClick={() => setShowLeaveConfirm(true)}
            />

            <main className="mx-auto grid min-h-[calc(100vh-92px)] max-w-[1800px] gap-0 lg:grid-cols-[minmax(380px,0.95fr)_minmax(520px,1.2fr)]">
                {/* Left panel: problem + participants */}
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
                                    {topicMap?.[topic as UUID] ?? topic}
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
                                    {participants.filter((p) => p.status === "connected").length}
                                    /2 present
                                </div>
                            </div>
                        </div>

                        {joinError && (
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
                        )}

                        <ProblemDescription
                            description={question?.description ?? null}
                            qnImage={question?.qnImage}
                        />
                        <ExamplesSection testCases={testRows} />
                        <ParticipantsPanel
                            participants={participants}
                            getDisplayName={getDisplayName}
                        />
                        <LiveChat collaborationId={collaborationId} />
                    </div>
                </section>

                {/* Right panel: editor + results */}
                <section className="flex min-h-[calc(100vh-92px)] flex-col bg-[#111827]">
                    <EditorToolbar
                        language={language || session?.language || "Language"}
                        isExecuting={isExecuting}
                        disabled={actionDisabled}
                        onRunCode={() => void runCode()}
                        onSubmitCode={() => void submitCode()}
                    />

                    <div className="grid flex-1 lg:grid-rows-[minmax(0,1.4fr)_minmax(280px,0.95fr)]">
                        <StatusBanners
                            sessionEnded={sessionEnded}
                            hasOfflineChanges={!!offlineChanges}
                            onReturnToDashboard={handleReturnToDashboard}
                            onSubmitOfflineChanges={submitOfflineChanges}
                            onDiscardOfflineChanges={discardOfflineChanges}
                        />

                        <CodeEditor
                            value={editorValue}
                            onChange={setEditorValue}
                            language={language}
                            disabled={!!sessionEnded}
                        />

                        <div className="grid min-h-[320px] lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.75fr)]">
                            <TestCasesPanel
                                testRows={testRows}
                                executionOutput={executionOutput}
                                executionResults={executionResults}
                            />
                            <AiHintsPanel
                                hints={hints}
                                isHintLoading={isHintLoading}
                                hintsRemaining={hintsRemaining}
                                disabled={!!sessionEnded}
                                onRequestHint={() => void requestHint()}
                                getDisplayName={getDisplayName}
                            />
                        </div>
                    </div>
                </section>
            </main>

            <SubmissionResultDialog
                submissionResult={submissionResult}
                onReturnHome={handleReturnHome}
            />

            <LeaveSessionDialog
                open={showLeaveConfirm}
                onCancel={() => setShowLeaveConfirm(false)}
                onConfirm={() => {
                    setShowLeaveConfirm(false);
                    handleReturnHome();
                }}
            />
        </div>
    );
}
