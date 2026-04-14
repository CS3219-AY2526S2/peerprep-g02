import { Clock3, Code2, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

interface SessionHeaderProps {
    title: string;
    elapsed: string;
    onExitClick: () => void;
}

export default function SessionHeader({
    title,
    elapsed,
    onExitClick,
}: SessionHeaderProps) {
    return (
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
                                {title}
                            </span>
                        </div>
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
                        onClick={onExitClick}
                    >
                        <LogOut className="size-4" />
                        Exit Session
                    </Button>
                </div>
            </div>
        </div>
    );
}
