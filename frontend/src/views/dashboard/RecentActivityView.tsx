import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "@clerk/clerk-react";
import { Check, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { AttemptHistoryItem } from "@/models/attempt/attemptHistoryType";
import { getAttemptHistory } from "@/services/attempt/attemptService";

type ActivityItem = {
    id: string;
    title: string;
    subtitle: string;
    timeAgo: string;
    icon: typeof Check | typeof XCircle;
    iconClassName: string;
};

function formatTimeAgo(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Recently";
    }

    const diffMs = Date.now() - date.getTime();

    if (diffMs < 60_000) {
        return "Just now";
    }

    const diffMinutes = Math.floor(diffMs / 60_000);
    if (diffMinutes < 60) {
        return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
        return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) {
        return "Yesterday";
    }

    if (diffDays < 7) {
        return `${diffDays} days ago`;
    }

    return new Intl.DateTimeFormat("en-SG", { dateStyle: "medium" }).format(date);
}

function toActivityItem(attempt: AttemptHistoryItem): ActivityItem {
    const fullyPassed =
        attempt.totalTestCases > 0 && attempt.testCasesPassed === attempt.totalTestCases;

    return {
        id: attempt.id,
        title: `${attempt.success ? "Completed" : "Attempted"}: ${attempt.questionTitle || attempt.questionId}`,
        subtitle: `${attempt.language} | ${attempt.difficulty} | ${attempt.testCasesPassed}/${attempt.totalTestCases} test cases${fullyPassed ? " | All passed" : ""}`,
        timeAgo: formatTimeAgo(attempt.attemptedAt),
        icon: attempt.success ? Check : XCircle,
        iconClassName: attempt.success
            ? "bg-emerald-100 text-emerald-600"
            : "bg-rose-100 text-rose-600",
    };
}

export function RecentActivityView() {
    const { isLoaded: isAuthLoaded } = useAuth();
    const [attempts, setAttempts] = useState<AttemptHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!isAuthLoaded) {
            return;
        }

        let isCancelled = false;

        void getAttemptHistory()
            .then((history) => {
                if (isCancelled) {
                    return;
                }

                setAttempts(history);
                setError("");
            })
            .catch((loadError) => {
                if (isCancelled) {
                    return;
                }

                setError(
                    loadError instanceof Error
                        ? loadError.message
                        : "Failed to load recent activity.",
                );
            })
            .finally(() => {
                if (!isCancelled) {
                    setLoading(false);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [isAuthLoaded]);

    const activityItems = useMemo(() => attempts.slice(0, 3).map(toActivityItem), [attempts]);

    return (
        <Card className="rounded-[30px] border border-white/70 bg-white/90 py-0 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
            <CardContent className="p-6 sm:p-8">
                <div className="mb-6 flex items-center justify-between gap-4">
                    <h2 className="text-3xl font-extrabold tracking-tight text-slate-950">
                        Recent Activity
                    </h2>
                    <Button
                        asChild
                        variant="link"
                        className="h-auto px-0 text-base font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                        <Link to={ROUTES.ATTEMPT_HISTORY}>View All</Link>
                    </Button>
                </div>

                <div className="space-y-4">
                    {loading
                        ? Array.from({ length: 3 }).map((_, index) => (
                              <div
                                  key={index}
                                  className="flex flex-col gap-4 rounded-[24px] border border-slate-100 bg-slate-50/90 px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                              >
                                  <div className="flex items-center gap-4">
                                      <div className="size-14 animate-pulse rounded-full bg-slate-200" />
                                      <div className="space-y-2">
                                          <div className="h-5 w-56 animate-pulse rounded-full bg-slate-200" />
                                          <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200" />
                                      </div>
                                  </div>
                                  <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200" />
                              </div>
                          ))
                        : null}

                    {!loading && error ? (
                        <div className="rounded-[24px] border border-rose-100 bg-rose-50/80 px-5 py-5 text-base text-rose-700 shadow-sm">
                            {error}
                        </div>
                    ) : null}

                    {!loading && !error && activityItems.length === 0 ? (
                        <div className="rounded-[24px] border border-slate-100 bg-slate-50/90 px-5 py-5 text-base text-slate-600 shadow-sm">
                            No recent attempts yet. Your completed sessions will show up here.
                        </div>
                    ) : null}

                    {!loading && !error
                        ? activityItems.map((item) => (
                              <div
                                  key={item.id}
                                  className="flex flex-col gap-4 rounded-[24px] border border-slate-100 bg-slate-50/90 px-5 py-5 shadow-sm transition-all hover:bg-slate-100/50 sm:flex-row sm:items-center sm:justify-between"
                              >
                                  <div className="flex items-center gap-4">
                                      <div
                                          className={cn(
                                              "flex size-14 shrink-0 items-center justify-center rounded-full shadow-sm",
                                              item.iconClassName,
                                          )}
                                      >
                                          <item.icon className="size-6" />
                                      </div>

                                      <div>
                                          <p className="text-xl font-bold tracking-tight text-slate-900">
                                              {item.title}
                                          </p>
                                          <p className="mt-1 text-base capitalize text-slate-600">
                                              {item.subtitle}
                                          </p>
                                      </div>
                                  </div>

                                  <p className="text-base font-medium text-slate-500 sm:pl-6">
                                      {item.timeAgo}
                                  </p>
                              </div>
                          ))
                        : null}
                </div>
            </CardContent>
        </Card>
    );
}
