import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth, useUser } from "@clerk/clerk-react";
import { Bell, Check, Clock3, Flame, Trophy, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import AccountUserButton from "@/components/user/AccountUserButton";

import { API_ENDPOINTS } from "@/constants/apiEndpoints";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/utils/apiClient";
import { pushToast } from "@/utils/toast";
import { StatCardProps } from "@/models/dashboard/dashboardType";

import { RecentActivityView } from "@/views/dashboard/RecentActivityView";
import { MatchingView } from "@/views/matching/MatchingView";

type UserRole = "user" | "admin" | "super_user";

function StatCard({ icon, value, label, accent, helper, footer, className }: StatCardProps) {
    return (
        <Card
            className={cn(
                "rounded-[28px] border-0 py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]",
                className,
            )}
        >
            <CardContent className="p-7">
                <div className="mb-8 flex items-start justify-between">
                    <div
                        className={cn(
                            "flex size-14 items-center justify-center rounded-2xl bg-white/20 text-white",
                            accent,
                        )}
                    >
                        {icon}
                    </div>
                    <div className="text-white/75">{helper}</div>
                </div>
                <div className="space-y-1">
                    <p className="text-5xl font-bold tracking-tight">{value}</p>
                    <p className="text-lg font-medium opacity-90">{label}</p>
                </div>
                {footer ? <div className="mt-6">{footer}</div> : null}
            </CardContent>
        </Card>
    );
}

export default function HomeView() {
    const { isLoaded: isAuthLoaded, isSignedIn, userId } = useAuth();
    const { user } = useUser();
    const lastSyncedUserIdRef = useRef<string | null>(null);
    const [role, setRole] = useState<UserRole | null>(null);

    const firstName = user?.firstName?.trim() || user?.username || "PeerPrep";
    const isAdmin = isSignedIn && (role === "admin" || role === "super_user");

    useEffect(() => {
        if (!isAuthLoaded || !isSignedIn || !userId) {
            lastSyncedUserIdRef.current = null;
            return;
        }

        if (lastSyncedUserIdRef.current === userId) {
            return;
        }

        lastSyncedUserIdRef.current = userId;

        void apiFetch(API_ENDPOINTS.USERS.ME, { method: "GET" })
            .then(async (response) => {
                const payload = await response.json().catch(() => null);

                if (!response.ok) {
                    pushToast({
                        tone: "error",
                        message: payload?.error || `Sync failed (status ${response.status})`,
                    });
                    return;
                }

                const fetchedRole = payload?.data?.user?.role;

                if (
                    fetchedRole === "user" ||
                    fetchedRole === "admin" ||
                    fetchedRole === "super_user"
                ) {
                    setRole(fetchedRole);
                }
            })
            .catch((error) => {
                const message =
                    error instanceof Error ? error.message : "Failed to sync account role.";
                pushToast({ message, tone: "error" });
            });
    }, [isAuthLoaded, isSignedIn, userId]);

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.10),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#f4f7fb_100%)] text-slate-900">
            {/* Header Section */}
            <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-5 lg:px-10">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
                            <span className="text-2xl font-semibold">&lt;/&gt;</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 lg:gap-4">
                            <p className="text-3xl font-extrabold tracking-tight">PeerPrep</p>

                            {isAdmin ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        asChild
                                        variant="outline"
                                        className="rounded-full border-slate-300 bg-white px-4"
                                    >
                                        <Link to={ROUTES.ATTEMPT_HISTORY}>Attempt History</Link>
                                    </Button>
                                    <Button
                                        asChild
                                        variant="outline"
                                        className="rounded-full border-slate-300 bg-white px-4"
                                    >
                                        <Link to={ROUTES.USER_ADMIN}>User Admin</Link>
                                    </Button>
                                    <Button
                                        asChild
                                        variant="outline"
                                        className="rounded-full border-slate-300 bg-white px-4"
                                    >
                                        <Link to={ROUTES.QUESTION_ADMIN}>Question Admin</Link>
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        asChild
                                        variant="outline"
                                        className="rounded-full border-slate-300 bg-white px-4"
                                    >
                                        <Link to={ROUTES.ATTEMPT_HISTORY}>Attempt History</Link>
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-5">
                        <Button
                            variant="ghost"
                            size="icon-lg"
                            className="rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        >
                            <Bell className="size-5" />
                            <span className="sr-only">Notifications</span>
                        </Button>

                        <AccountUserButton role={role} />
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-12">
                <section className="mb-10">
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
                        Welcome back, {firstName}! <span className="inline-block">👋</span>
                    </h1>
                    <p className="mt-3 text-lg text-slate-600">
                        Ready to sharpen your coding skills with a peer?
                    </p>
                </section>

                <div className="grid gap-8 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.8fr)]">
                    <div className="space-y-8">
                        <MatchingView />
                        <RecentActivityView />
                    </div>

                    <aside className="space-y-6">
                        <StatCard
                            icon={<Check className="size-7" />}
                            value="24"
                            label="Sessions Completed"
                            helper={<Zap className="size-5" />}
                            className="bg-gradient-to-br from-indigo-500 via-indigo-500 to-violet-600 text-white"
                            footer={
                                <span className="inline-flex rounded-xl bg-white/15 px-3 py-2 text-base font-semibold text-white/95">
                                    +3 this week
                                </span>
                            }
                        />

                        <Card className="rounded-[28px] border-0 bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                            <CardContent className="p-7">
                                <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                                    <Clock3 className="size-7" />
                                </div>
                                <p className="text-5xl font-bold tracking-tight text-slate-950">
                                    42 min
                                </p>
                                <p className="mt-2 text-xl font-semibold text-slate-600">
                                    Average Duration
                                </p>
                                <div className="mt-6 border-t border-slate-200 pt-5 text-base text-slate-500">
                                    <div className="flex items-center justify-between gap-4">
                                        <span>Longest session</span>
                                        <span className="font-semibold text-slate-900">1h 15m</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-[28px] border-0 bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                            <CardContent className="p-7">
                                <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                                    <Trophy className="size-7" />
                                </div>
                                <p className="text-5xl font-bold tracking-tight text-slate-950">
                                    87%
                                </p>
                                <p className="mt-2 text-xl font-semibold text-slate-600">
                                    Success Rate
                                </p>
                                <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-200">
                                    <div className="h-full w-[87%] rounded-full bg-emerald-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <StatCard
                            icon={<Flame className="size-7" />}
                            value="7 days"
                            label="Current Streak"
                            className="bg-gradient-to-br from-orange-400 to-orange-500 text-white"
                            footer={
                                <p className="text-lg font-semibold text-white/95">
                                    Keep it up! 🎉
                                </p>
                            }
                        />
                    </aside>
                </div>
            </main>
        </div>
    );
}
