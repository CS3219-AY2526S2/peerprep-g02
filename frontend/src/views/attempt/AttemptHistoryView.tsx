import {
    type ComponentType,
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { Link } from "react-router-dom";

import { useAuth } from "@clerk/clerk-react";
import { ArrowLeft, CheckCircle2, Clock3, History, RefreshCw, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { AttemptHistoryItem } from "@/models/attempt/attemptHistoryType";
import { getAttemptHistory } from "@/services/attempt/attemptService";

type StatCardProps = {
    title: string;
    value: number | string;
    description: string;
    icon: ComponentType<{ className?: string }>;
    className?: string;
    iconClassName?: string;
    valueClassName?: string;
    descriptionClassName?: string;
    titleClassName?: string;
};

type StatePanelProps = {
    title: string;
    description: string;
    action?: ReactNode;
};

const MIN_LOADING_FEEDBACK_MS = 250;

function formatDuration(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
        return "0m";
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    return `${Math.max(minutes, 1)}m`;
}

function formatAttemptedAt(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Unknown date";
    }

    return new Intl.DateTimeFormat("en-SG", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function StatCardSkeleton() {
    return (
        <Card className="rounded-[28px] border-0 bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <CardContent className="p-7">
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div className="size-14 animate-pulse rounded-2xl bg-slate-100" />
                    <div className="h-4 w-28 animate-pulse rounded-full bg-slate-100" />
                </div>
                <div className="h-12 w-20 animate-pulse rounded-full bg-slate-100" />
                <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-slate-100" />
            </CardContent>
        </Card>
    );
}

function StatCard({
    title,
    value,
    description,
    icon: Icon,
    className,
    iconClassName,
    valueClassName,
    descriptionClassName,
    titleClassName,
}: StatCardProps) {
    return (
        <Card
            className={cn(
                "rounded-[28px] border-0 bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]",
                className,
            )}
        >
            <CardContent className="p-7">
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div
                        className={cn(
                            "flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700",
                            iconClassName,
                        )}
                    >
                        <Icon className="size-7" />
                    </div>
                    <p className={cn("text-sm font-medium text-black", titleClassName)}>{title}</p>
                </div>
                <p
                    className={cn(
                        "text-5xl font-bold tracking-tight text-slate-950",
                        valueClassName,
                    )}
                >
                    {value}
                </p>
                <p className={cn("mt-2 text-base text-slate-600", descriptionClassName)}>
                    {description}
                </p>
            </CardContent>
        </Card>
    );
}

function StatePanel({ title, description, action }: StatePanelProps) {
    return (
        <div className="flex min-h-60 flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 px-6 text-center">
            <p className="text-lg font-bold tracking-tight text-slate-950">{title}</p>
            <p className="mt-2 max-w-xl text-sm text-slate-600">{description}</p>
            {action ? <div className="mt-5">{action}</div> : null}
        </div>
    );
}

function DifficultyBadge({ difficulty }: { difficulty: AttemptHistoryItem["difficulty"] }) {
    if (difficulty === "Easy") {
        return (
            <Badge
                variant="success"
                className="inline-flex rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[0.8rem] font-semibold"
            >
                Easy
            </Badge>
        );
    }

    if (difficulty === "Medium") {
        return (
            <Badge
                variant="warning"
                className="inline-flex rounded-full border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[0.8rem] font-semibold"
            >
                Medium
            </Badge>
        );
    }

    return (
        <Badge
            variant="destructive"
            className="inline-flex rounded-full border-red-200 bg-red-50 px-2.5 py-0.5 text-[0.8rem] font-semibold"
        >
            Hard
        </Badge>
    );
}

function StatusBadge({ success }: { success: boolean }) {
    return success ? (
        <Badge
            variant="success"
            className="inline-flex rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[0.8rem] font-semibold"
        >
            Success
        </Badge>
    ) : (
        <Badge
            variant="destructive"
            className="inline-flex rounded-full border-red-200 bg-red-50 px-2.5 py-0.5 text-[0.8rem] font-semibold"
        >
            Unsuccessful
        </Badge>
    );
}

function AttemptHistoryTable({ attempts }: { attempts: AttemptHistoryItem[] }) {
    return (
        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
            <Table className="table-fixed">
                <TableHeader>
                    <TableRow className="border-slate-200 bg-slate-50 hover:bg-slate-50">
                        <TableHead className="w-[30%] px-4 text-slate-950">Question</TableHead>
                        <TableHead className="w-[12%] px-4 text-center text-slate-950">
                            Result
                        </TableHead>
                        <TableHead className="w-[12%] px-4 text-center text-slate-950">
                            Difficulty
                        </TableHead>
                        <TableHead className="w-[14%] px-4 text-center text-slate-950">
                            Language
                        </TableHead>
                        <TableHead className="w-[12%] px-4 text-center text-slate-950">
                            Duration
                        </TableHead>
                        <TableHead className="w-[20%] px-4 text-right text-slate-950">
                            Attempted
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {attempts.map((attempt) => (
                        <TableRow
                            key={attempt.id}
                            className="border-slate-200 hover:bg-slate-50/70"
                        >
                            <TableCell className="px-4 py-4">
                                <div>
                                    <p className="truncate text-[0.95rem] font-semibold text-slate-950">
                                        {attempt.questionId}
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell className="px-4 py-4 text-center">
                                <div className="flex justify-center">
                                    <StatusBadge success={attempt.success} />
                                </div>
                            </TableCell>
                            <TableCell className="px-4 py-4 text-center">
                                <div className="flex justify-center">
                                    <DifficultyBadge difficulty={attempt.difficulty} />
                                </div>
                            </TableCell>
                            <TableCell className="px-4 py-4 text-center">
                                <span className="text-[0.9rem] font-medium capitalize text-slate-700">
                                    {attempt.language}
                                </span>
                            </TableCell>
                            <TableCell className="px-4 py-4 text-center">
                                <span className="text-[0.9rem] font-medium text-slate-700">
                                    {formatDuration(attempt.duration)}
                                </span>
                            </TableCell>
                            <TableCell className="px-4 py-4 text-right">
                                <span className="text-[0.9rem] text-slate-600">
                                    {formatAttemptedAt(attempt.attemptedAt)}
                                </span>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export default function AttemptHistoryView() {
    const { isLoaded: isAuthLoaded } = useAuth();
    const [attempts, setAttempts] = useState<AttemptHistoryItem[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadAttemptHistory = useCallback(async () => {
        if (!isAuthLoaded) {
            return;
        }

        const loadStartedAt = Date.now();
        setLoading(true);
        setError("");

        try {
            const fetchedAttempts = await getAttemptHistory();
            setAttempts(fetchedAttempts);
        } catch (loadError) {
            setError(
                loadError instanceof Error ? loadError.message : "Failed to load attempt history.",
            );
        } finally {
            const remainingFeedbackMs = MIN_LOADING_FEEDBACK_MS - (Date.now() - loadStartedAt);

            if (remainingFeedbackMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, remainingFeedbackMs));
            }

            setLoading(false);
        }
    }, [isAuthLoaded]);

    useEffect(() => {
        void loadAttemptHistory();
    }, [loadAttemptHistory]);

    const filteredAttempts = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        if (!normalizedSearch) {
            return attempts;
        }

        return attempts.filter((attempt) =>
            [
                attempt.questionId,
                attempt.language,
                attempt.difficulty,
                attempt.success ? "success" : "unsuccessful",
            ].some((value) => value.toLowerCase().includes(normalizedSearch)),
        );
    }, [attempts, search]);

    const stats = useMemo(() => {
        const successfulAttempts = attempts.filter((attempt) => attempt.success).length;
        const averageDuration =
            attempts.length > 0
                ? formatDuration(
                      Math.round(
                          attempts.reduce((total, attempt) => total + attempt.duration, 0) /
                              attempts.length,
                      ),
                  )
                : "0m";

        return {
            totalAttempts: attempts.length,
            successfulAttempts,
            averageDuration,
        };
    }, [attempts]);

    const isInitialLoad =
        (!isAuthLoaded && attempts.length === 0) || (loading && attempts.length === 0);
    const isEmpty = !loading && !error && filteredAttempts.length === 0;

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.10),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#f4f7fb_100%)] text-slate-900">
            <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-5 lg:px-10">
                    <div className="flex items-center gap-4">
                        <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
                            <span className="text-2xl font-semibold">&lt;/&gt;</span>
                        </div>
                        <div>
                            <p className="text-3xl font-extrabold tracking-tight text-slate-950">
                                PeerPrep
                            </p>
                            <p className="text-sm text-slate-500">Attempt history</p>
                        </div>
                    </div>

                    <Button
                        asChild
                        variant="outline"
                        size="lg"
                        className="rounded-full border-slate-300 bg-white px-5"
                    >
                        <Link to={ROUTES.DASHBOARD}>
                            <ArrowLeft className="size-4" />
                            Back to dashboard
                        </Link>
                    </Button>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-12">
                <section className="mb-10">
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
                        Attempt history
                    </h1>
                    <p className="mt-3 max-w-3xl text-lg text-slate-600">
                        Review your completed attempts, track outcomes over time, and revisit the
                        questions you have already worked on.
                    </p>
                </section>

                <section className="grid gap-6 md:grid-cols-3">
                    {isInitialLoad ? (
                        <>
                            <StatCardSkeleton />
                            <StatCardSkeleton />
                            <StatCardSkeleton />
                        </>
                    ) : (
                        <>
                            <StatCard
                                title="Total attempts"
                                value={stats.totalAttempts}
                                description="All recorded attempts for your account."
                                icon={History}
                                className="bg-gradient-to-br from-indigo-500 via-indigo-500 to-violet-600 text-white"
                                iconClassName="bg-white/15 text-white"
                                valueClassName="text-white"
                                descriptionClassName="text-white/85"
                                titleClassName="text-white"
                            />
                            <StatCard
                                title="Successful"
                                value={stats.successfulAttempts}
                                description="Attempts marked as successful."
                                icon={CheckCircle2}
                                iconClassName="bg-emerald-100 text-emerald-600"
                            />
                            <StatCard
                                title="Average duration"
                                value={stats.averageDuration}
                                description="Average time spent per attempt."
                                icon={Clock3}
                                iconClassName="bg-sky-100 text-sky-600"
                            />
                        </>
                    )}
                </section>

                <section className="mt-8">
                    <Card className="rounded-[30px] border border-white/70 bg-white/90 py-0 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
                        <CardHeader className="gap-5 border-b border-slate-200 px-6 py-6 sm:px-8">
                            <div className="space-y-1">
                                <CardTitle className="text-3xl font-extrabold tracking-tight text-slate-950">
                                    Attempt History
                                </CardTitle>
                                <CardDescription className="text-base text-slate-600">
                                    {isInitialLoad
                                        ? "Preparing your attempt history..."
                                        : loading
                                          ? "Refreshing attempt history..."
                                          : `${filteredAttempts.length} result${filteredAttempts.length === 1 ? "" : "s"}${search.trim() ? ` for "${search.trim()}"` : ""}.`}
                                </CardDescription>
                            </div>

                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="relative w-full md:max-w-md">
                                    <Search className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        type="search"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Search by question, language, or result"
                                        className="h-11 rounded-full border-slate-200 bg-white pl-14 pr-4 text-slate-900 shadow-sm"
                                    />
                                </div>

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => void loadAttemptHistory()}
                                    disabled={loading}
                                    className="rounded-full border-slate-300 bg-white px-5"
                                >
                                    <RefreshCw
                                        className={cn("size-4", loading && "animate-spin")}
                                    />
                                    Refresh
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent className="p-6 sm:p-8">
                            {isInitialLoad ? (
                                <div className="grid gap-4">
                                    {Array.from({ length: 5 }).map((_, index) => (
                                        <div
                                            key={index}
                                            className="h-16 animate-pulse rounded-[20px] bg-slate-100"
                                        />
                                    ))}
                                </div>
                            ) : null}

                            {!loading && error ? (
                                <StatePanel
                                    title="Unable to load attempt history"
                                    description={error}
                                    action={
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => void loadAttemptHistory()}
                                            className="rounded-full border-slate-300 bg-white px-5"
                                        >
                                            Try again
                                        </Button>
                                    }
                                />
                            ) : null}

                            {isEmpty ? (
                                <StatePanel
                                    title={
                                        attempts.length === 0
                                            ? "No attempts yet"
                                            : "No attempts found"
                                    }
                                    description={
                                        attempts.length === 0
                                            ? "Your completed attempt records will appear here after you finish collaboration sessions."
                                            : "Try a different search term to find a past attempt."
                                    }
                                />
                            ) : null}

                            {!loading && !error && !isEmpty ? (
                                <AttemptHistoryTable attempts={filteredAttempts} />
                            ) : null}
                        </CardContent>
                    </Card>
                </section>
            </main>
        </div>
    );
}
