import { Lightbulb, LoaderCircle, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { AiHint } from "@/models/collaboration/aiHintType";
import { getInitials } from "@/components/collaboration/utils";

interface AiHintsPanelProps {
    hints: AiHint[];
    isHintLoading: boolean;
    hintsRemaining: number;
    disabled: boolean;
    onRequestHint: () => void;
    getDisplayName: (userId: string) => string;
}

export default function AiHintsPanel({
    hints,
    isHintLoading,
    hintsRemaining,
    disabled,
    onRequestHint,
    getDisplayName,
}: AiHintsPanelProps) {
    return (
        <div className="flex min-h-[320px] flex-col">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-3">
                    <Sparkles className="size-5 text-violet-300" />
                    <h2 className="text-2xl font-semibold text-white">AI Hints</h2>
                </div>
                <Badge
                    variant={hintsRemaining > 0 ? "outline" : "destructive"}
                    className="rounded-full border-violet-500/30 bg-violet-500/10 px-3 py-1 text-sm text-violet-300"
                >
                    {hintsRemaining}/2 remaining
                </Badge>
            </div>

            <div className="flex-1 space-y-3 overflow-auto px-5 py-5">
                {hints.length === 0 && !isHintLoading && (
                    <div className="flex items-center gap-3 py-3 text-center">
                        <Lightbulb className="size-8 shrink-0 text-slate-600" />
                        <p className="text-sm text-slate-500">
                            Stuck? Use AI hints to get guidance. Each user gets 2 hints per session.
                        </p>
                    </div>
                )}
                {hints.map((hint, index) => {
                    const name = getDisplayName(hint.userId);
                    return (
                        <div
                            key={`${hint.timestamp}-${index}`}
                            className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4"
                        >
                            <div className="mb-2 flex items-center gap-2">
                                <div className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-purple-500 text-xs font-bold text-white">
                                    {getInitials(name, hint.userId)}
                                </div>
                                <span className="text-xs font-medium text-violet-300">
                                    Hint {index + 1}
                                </span>
                                <span className="text-xs text-slate-500">by {name}</span>
                            </div>
                            <p className="text-sm leading-relaxed text-slate-200">{hint.hint}</p>
                        </div>
                    );
                })}
                {isHintLoading && (
                    <div className="flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                        <LoaderCircle className="size-5 animate-spin text-violet-400" />
                        <span className="text-sm text-violet-300">Generating hint...</span>
                    </div>
                )}
            </div>

            <div className="border-t border-white/10 px-5 py-4">
                <Button
                    className="w-full rounded-2xl bg-violet-500 text-white hover:bg-violet-400"
                    disabled={hintsRemaining <= 0 || isHintLoading || disabled}
                    onClick={onRequestHint}
                >
                    {isHintLoading ? (
                        <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                        <Sparkles className="size-4" />
                    )}
                    {hintsRemaining <= 0 ? "No hints remaining" : "Get AI Hint"}
                </Button>
            </div>
        </div>
    );
}
