import { useUser } from "@clerk/clerk-react";
import { useEffect, useMemo, useRef, useState } from "react";

import AccountUserButton from "@/components/user/profile/AccountUserButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/apiClient";
import { pushToast } from "@/lib/toast";

const topics = [
    "Arrays & Strings",
    "Trees & Graphs",
    "Dynamic Programming",
    "Backtracking",
    "System Design",
] as const;

const languages = ["JavaScript", "TypeScript", "Python", "Java", "C++"] as const;

const activities = [
    {
        id: "activity-1",
        title: "Completed: Two Sum Problem",
        description: "With Sarah M. • Arrays & Strings • Easy",
        timeLabel: "2 hours ago",
        accent: "emerald",
    },
    {
        id: "activity-2",
        title: "Completed: Binary Tree Traversal",
        description: "With Mike R. • Trees & Graphs • Medium",
        timeLabel: "Yesterday",
        accent: "blue",
    },
    {
        id: "activity-3",
        title: "Achievement Unlocked: 7 Day Streak",
        description: "Keep practicing daily!",
        timeLabel: "2 days ago",
        accent: "violet",
    },
] as const;

type DifficultyOption = "Easy" | "Medium" | "Hard";

const difficultyOptions: Array<{
    value: DifficultyOption;
    label: string;
    accent: string;
    icon: string;
}> = [
    {
        value: "Easy",
        label: "Easy",
        accent:
            "border-emerald-400 bg-emerald-50 text-emerald-700 shadow-[0_0_0_1px_rgba(52,211,153,0.25)]",
        icon: "🌱",
    },
    {
        value: "Medium",
        label: "Medium",
        accent: "border-slate-200 bg-white text-slate-700",
        icon: "⏱",
    },
    {
        value: "Hard",
        label: "Hard",
        accent: "border-slate-200 bg-white text-slate-700",
        icon: "⚡",
    },
];

function BellIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path
                d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M10 20a2 2 0 0 0 4 0"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function RocketIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14.5 3c2.9 0 5.5 1.2 7.5 3.2-1 3.6-3.3 6.8-6.6 8.9l-2.9 1.9-2.2-2.2 1.9-2.9c2.1-3.3 5.3-5.6 8.9-6.6A10.5 10.5 0 0 0 14.5 3ZM7.5 13.5l3 3-2.8 2.8a2.8 2.8 0 0 1-2 .8H3v-2.7c0-.8.3-1.5.8-2l3.7-3.9ZM5 9l2-2 2 2-2 2-2-2Z" />
        </svg>
    );
}

function CheckTileIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m6 12 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" />
        </svg>
    );
}

function ClockIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 8v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function TrophyIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" />
            <path d="M6 5H4a2 2 0 0 0 0 4h2" />
            <path d="M18 5h2a2 2 0 1 1 0 4h-2" />
            <path d="M12 11v4" />
            <path d="M9 19h6" />
        </svg>
    );
}

function FlameIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
                d="M12 3c1 3-1 4.5-1 6.5 0 1.4 1 2.5 2.5 2.5 1.8 0 3-1.5 3-3.4 0-2.1-1.4-3.7-2.5-4.6 2.8.8 5 3.6 5 7 0 4.1-3.1 7-7 7s-7-2.9-7-7c0-2.6 1.1-4.7 3.1-6.2.1 2 .9 3.2 2.6 3.2C12.3 8 13 7 13 5.8c0-1.1-.4-1.9-1-2.8Z"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function ActivityBadge({ accent }: { accent: (typeof activities)[number]["accent"] }) {
    if (accent === "emerald") {
        return (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <span className="text-xl">✓</span>
            </div>
        );
    }

    if (accent === "blue") {
        return (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <span className="text-xl">{"</>"}</span>
            </div>
        );
    }

    return (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-violet-600">
            <span className="text-xl">★</span>
        </div>
    );
}

export default function Profile() {
    const { isLoaded, user } = useUser();
    const lastSyncedUserIdRef = useRef<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [topic, setTopic] = useState<(typeof topics)[number]>(topics[0]);
    const [difficulty, setDifficulty] = useState<DifficultyOption>("Easy");
    const [language, setLanguage] = useState<(typeof languages)[number]>(languages[0]);

    useEffect(() => {
        if (!isLoaded || !user?.id) {
            return;
        }

        if (lastSyncedUserIdRef.current === user.id) {
            return;
        }

        lastSyncedUserIdRef.current = user.id;

        void apiFetch("/users/me", { method: "GET" })
            .then(async (response) => {
                if (!response.ok) {
                    return;
                }

                const payload = await response.json().catch(() => null);
                const fetchedRole = payload?.data?.user?.role;
                if (typeof fetchedRole === "string") {
                    setRole(fetchedRole);
                }
            })
            .catch(() => {
                setRole(null);
            });
    }, [isLoaded, user?.id]);

    const displayName = useMemo(() => {
        return user?.firstName ?? user?.fullName ?? "Peer2Prep";
    }, [user?.firstName, user?.fullName]);

    const handleFindPeer = () => {
        pushToast({
            tone: "success",
            message: `Queueing for ${topic} • ${difficulty} • ${language}`,
        });
    };

    if (!isLoaded) {
        return null;
    }

    return (
        <section className="min-h-screen bg-[linear-gradient(180deg,#f8faff_0%,#f3f6fb_100%)] text-slate-900">
            <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
                <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-4 py-5 sm:px-6 lg:px-10">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#6b5cff_0%,#4c46e8_100%)] text-xl font-bold text-white shadow-[0_16px_36px_rgba(88,80,236,0.28)]">
                            {"</>"}
                        </div>
                        <div>
                            <div className="text-[2rem] font-black tracking-[-0.04em] text-slate-900">
                                Peer2Prep
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-slate-600">
                        <button
                            type="button"
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                            <span className="h-5 w-5">
                                <BellIcon />
                            </span>
                        </button>
                        <div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm md:flex">
                            <AccountUserButton role={role} />
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                    {displayName}
                                </p>
                                <p className="text-xs text-slate-500">Ready to practice</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-10">
                <section className="rounded-[2rem] border border-white/80 bg-white/60 px-6 py-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:px-8">
                    <h1 className="text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">
                        Welcome back, {displayName}! <span className="inline-block">👋</span>
                    </h1>
                    <p className="mt-3 max-w-2xl text-lg text-slate-500 sm:text-xl">
                        Ready to sharpen your coding skills with a peer?
                    </p>
                    {role === "admin" || role === "super_user" ? (
                        <div className="mt-5">
                            <a
                                href="/account/admin"
                                className="inline-flex items-center rounded-full border border-[#d9d7ff] bg-[#f4f3ff] px-4 py-2 text-sm font-semibold text-[#4c46e8] transition hover:bg-[#ebe9ff]"
                            >
                                Open Admin Page
                            </a>
                        </div>
                    ) : null}
                </section>

                <div className="grid gap-8 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
                    <div className="space-y-8">
                        <Card className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                            <CardContent className="p-6 sm:p-8">
                                <div className="mb-8 flex items-start justify-between gap-4">
                                    <div>
                                        <h2 className="text-2xl font-black tracking-[-0.03em] text-slate-950 sm:text-3xl">
                                            Start a Practice Session
                                        </h2>
                                    </div>
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eef1ff] text-[#5a54f6] shadow-inner">
                                        <span className="h-8 w-8">
                                            <RocketIcon />
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-7">
                                    <div className="space-y-3">
                                        <label
                                            htmlFor="topic"
                                            className="block text-base font-semibold text-slate-700"
                                        >
                                            Select Topic
                                        </label>
                                        <select
                                            id="topic"
                                            value={topic}
                                            onChange={(event) =>
                                                setTopic(
                                                    event.target.value as (typeof topics)[number],
                                                )
                                            }
                                            className="h-16 w-full rounded-2xl border border-slate-200 bg-white px-5 text-xl font-semibold text-slate-800 outline-none transition focus:border-[#675dff] focus:ring-4 focus:ring-[#675dff]/10"
                                        >
                                            {topics.map((option) => (
                                                <option key={option} value={option}>
                                                    {option}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-3">
                                        <p className="text-base font-semibold text-slate-700">
                                            Difficulty Level
                                        </p>
                                        <div className="grid gap-3 sm:grid-cols-3">
                                            {difficultyOptions.map((option) => {
                                                const isActive = difficulty === option.value;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => setDifficulty(option.value)}
                                                        className={[
                                                            "flex h-16 items-center justify-center gap-3 rounded-2xl border text-xl font-bold transition",
                                                            isActive
                                                                ? option.value === "Easy"
                                                                    ? option.accent
                                                                    : "border-[#675dff] bg-[#f2f0ff] text-[#4c46e8]"
                                                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                                                        ].join(" ")}
                                                    >
                                                        <span>{option.icon}</span>
                                                        <span>{option.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label
                                            htmlFor="language"
                                            className="block text-base font-semibold text-slate-700"
                                        >
                                            Programming Language
                                        </label>
                                        <select
                                            id="language"
                                            value={language}
                                            onChange={(event) =>
                                                setLanguage(
                                                    event.target.value as (typeof languages)[number],
                                                )
                                            }
                                            className="h-16 w-full rounded-2xl border border-slate-200 bg-white px-5 text-xl font-semibold text-slate-800 outline-none transition focus:border-[#675dff] focus:ring-4 focus:ring-[#675dff]/10"
                                        >
                                            {languages.map((option) => (
                                                <option key={option} value={option}>
                                                    {option}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <Button
                                        type="button"
                                        onClick={handleFindPeer}
                                        className="h-18 flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#5f58f6_0%,#4a46df_100%)] py-7 text-2xl font-bold shadow-[0_18px_36px_rgba(93,82,240,0.28)] transition hover:translate-y-[-1px] hover:opacity-95"
                                    >
                                        <span className="text-2xl">👥</span>
                                        <span>Find a Peer</span>
                                    </Button>

                                    <div className="flex items-center justify-center gap-2 pt-2 text-lg text-slate-500">
                                        <span>🕒</span>
                                        <span>Average wait time: 2-3 minutes</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                            <CardContent className="p-6 sm:p-8">
                                <div className="mb-6 flex items-center justify-between gap-4">
                                    <h2 className="text-2xl font-black tracking-[-0.03em] text-slate-950">
                                        Recent Activity
                                    </h2>
                                    <a
                                        href="#"
                                        className="text-lg font-semibold text-[#5b54f6] transition hover:text-[#433dd8]"
                                    >
                                        View All
                                    </a>
                                </div>

                                <div className="space-y-4">
                                    {activities.map((activity) => (
                                        <div
                                            key={activity.id}
                                            className="flex flex-col gap-4 rounded-[1.5rem] bg-[#f8faff] px-5 py-5 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.65)] sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="flex items-center gap-4">
                                                <ActivityBadge accent={activity.accent} />
                                                <div>
                                                    <p className="text-xl font-bold tracking-[-0.02em] text-slate-900">
                                                        {activity.title}
                                                    </p>
                                                    <p className="mt-1 text-lg text-slate-500">
                                                        {activity.description}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="text-lg font-medium text-slate-500">
                                                {activity.timeLabel}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <aside className="space-y-6">
                        <Card className="overflow-hidden rounded-[2rem] border-0 bg-[linear-gradient(135deg,#6b5cff_0%,#4a46e6_100%)] text-white shadow-[0_22px_50px_rgba(88,80,236,0.35)]">
                            <CardContent className="p-8">
                                <div className="flex items-start justify-between">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                                        <span className="h-7 w-7">
                                            <CheckTileIcon />
                                        </span>
                                    </div>
                                    <span className="text-2xl text-white/80">↗</span>
                                </div>
                                <div className="mt-8">
                                    <p className="text-6xl font-black tracking-[-0.05em]">24</p>
                                    <p className="mt-2 text-2xl font-semibold text-white/80">
                                        Sessions Completed
                                    </p>
                                    <span className="mt-5 inline-flex rounded-xl bg-white/14 px-4 py-2 text-lg font-semibold text-white/85">
                                        +3 this week
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                            <CardContent className="p-8">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                                    <span className="h-7 w-7">
                                        <ClockIcon />
                                    </span>
                                </div>
                                <p className="mt-7 text-5xl font-black tracking-[-0.05em] text-slate-950">
                                    42 min
                                </p>
                                <p className="mt-2 text-2xl font-semibold text-slate-500">
                                    Average Duration
                                </p>
                                <div className="mt-6 border-t border-slate-200 pt-6">
                                    <div className="flex items-center justify-between text-lg">
                                        <span className="text-slate-500">Longest session</span>
                                        <span className="font-bold text-slate-900">1h 15m</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                            <CardContent className="p-8">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                                    <span className="h-7 w-7">
                                        <TrophyIcon />
                                    </span>
                                </div>
                                <p className="mt-7 text-5xl font-black tracking-[-0.05em] text-slate-950">
                                    87%
                                </p>
                                <p className="mt-2 text-2xl font-semibold text-slate-500">
                                    Success Rate
                                </p>
                                <div className="mt-7 h-3 rounded-full bg-slate-200">
                                    <div className="h-3 w-[87%] rounded-full bg-emerald-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="overflow-hidden rounded-[2rem] border-0 bg-[linear-gradient(135deg,#ff982f_0%,#ff7a1f_100%)] text-white shadow-[0_22px_50px_rgba(255,136,35,0.3)]">
                            <CardContent className="p-8">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/18 text-white">
                                    <span className="h-7 w-7">
                                        <FlameIcon />
                                    </span>
                                </div>
                                <p className="mt-8 text-6xl font-black tracking-[-0.05em]">
                                    7 days
                                </p>
                                <p className="mt-2 text-2xl font-semibold text-white/85">
                                    Current Streak
                                </p>
                                <p className="mt-6 text-2xl font-semibold text-white/90">
                                    Keep it up! <span className="inline-block">🎉</span>
                                </p>
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            </div>
        </section>
    );
}
