import { Check, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { cn } from "@/lib/utils";

const activityItems = [
    {
        title: "Completed: Two Sum Problem",
        subtitle: "With Sarah M. • Arrays & Strings • Easy",
        timeAgo: "2 hours ago",
        icon: Check,
        iconClassName: "bg-emerald-100 text-emerald-600",
    },
    {
        title: "Completed: Binary Tree Traversal",
        subtitle: "With Mike R. • Trees & Graphs • Medium",
        timeAgo: "Yesterday",
        icon: "</>",
        iconClassName: "bg-blue-100 text-blue-600",
    },
    {
        title: "Achievement Unlocked: 7 Day Streak",
        subtitle: "Keep practicing daily!",
        timeAgo: "2 days ago",
        icon: Trophy,
        iconClassName: "bg-violet-100 text-violet-600",
    },
] as const;

export function RecentActivityView() {
    return (
        <Card className="rounded-[30px] border border-white/70 bg-white/90 py-0 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
            <CardContent className="p-6 sm:p-8">
                <div className="mb-6 flex items-center justify-between gap-4">
                    <h2 className="text-3xl font-extrabold tracking-tight text-slate-950">
                        Recent Activity
                    </h2>
                    <Button
                        variant="link"
                        className="h-auto px-0 text-base font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                        View All
                    </Button>
                </div>

                <div className="space-y-4">
                    {activityItems.map((item) => (
                        <div
                            key={item.title}
                            className="flex flex-col gap-4 rounded-[24px] border border-slate-100 bg-slate-50/90 px-5 py-5 shadow-sm transition-all hover:bg-slate-100/50 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="flex items-center gap-4">
                                <div
                                    className={cn(
                                        "flex size-14 shrink-0 items-center justify-center rounded-full shadow-sm",
                                        item.iconClassName,
                                    )}
                                >
                                    {typeof item.icon === "string" ? (
                                        <span className="text-lg font-bold">{item.icon}</span>
                                    ) : (
                                        <item.icon className="size-6" />
                                    )}
                                </div>

                                <div>
                                    <p className="text-xl font-bold tracking-tight text-slate-900">
                                        {item.title}
                                    </p>
                                    <p className="mt-1 text-base text-slate-600">{item.subtitle}</p>
                                </div>
                            </div>

                            <p className="text-base font-medium text-slate-500 sm:pl-6">
                                {item.timeAgo}
                            </p>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
