import { useClerk, useUser } from "@clerk/clerk-react";
import {
    Bell,
    Check,
    ChevronDown,
    Clock3,
    Flame,
    LogOut,
    Trophy,
    Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { StatCardProps } from "@/models/dashboard/dashboardType";

import { MatchingView } from "@/views/matching/MatchingView";
import { RecentActivityView } from "@/views/dashboard/RecentActivityView";


function StatCard({
    icon,
    value,
    label,
    accent,
    helper,
    footer,
    className,
}: StatCardProps) {
    return (
        <Card className={cn("rounded-[28px] border-0 py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]", className)}>
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
    const { user, isLoaded } = useUser();
    const { signOut } = useClerk();

    const firstName = user?.firstName?.trim() || user?.username || "Peer2Prep";
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Alex Johnson";
    const avatarUrl = user?.imageUrl;

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.10),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#f4f7fb_100%)] text-slate-900">
            {/* Header Section */}
            <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-5 lg:px-10">
                    <div className="flex items-center gap-4">
                        <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
                            <span className="text-2xl font-semibold">&lt;/&gt;</span>
                        </div>
                        <div>
                            <p className="text-3xl font-extrabold tracking-tight">Peer2Prep</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-5">
                        <Button variant="ghost" size="icon-lg" className="rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                            <Bell className="size-5" />
                            <span className="sr-only">Notifications</span>
                        </Button>

                        <div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm sm:flex">
                            <div className="size-11 overflow-hidden rounded-full bg-gradient-to-br from-pink-400 to-sky-400">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
                                        {fullName
                                            .split(" ")
                                            .map((part) => part[0])
                                            .join("")
                                            .slice(0, 2)}
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">{fullName}</p>
                                <p className="text-xs text-slate-500">
                                    {isLoaded ? "Ready to practice" : "Loading account..."}
                                </p>
                            </div>
                            <ChevronDown className="size-4 text-slate-400" />
                        </div>

                        <Button
                            variant="ghost"
                            className="gap-2 rounded-full px-4 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            onClick={() => void signOut({ redirectUrl: ROUTES.LOGIN })}
                        >
                            <LogOut className="size-4" />
                            Logout
                        </Button>
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
                                <p className="text-5xl font-bold tracking-tight text-slate-950">42 min</p>
                                <p className="mt-2 text-xl font-semibold text-slate-600">Average Duration</p>
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
                                <p className="text-5xl font-bold tracking-tight text-slate-950">87%</p>
                                <p className="mt-2 text-xl font-semibold text-slate-600">Success Rate</p>
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
                            footer={<p className="text-lg font-semibold text-white/95">Keep it up! 🎉</p>}
                        />
                    </aside>
                </div>
            </main>
        </div>
    );
}