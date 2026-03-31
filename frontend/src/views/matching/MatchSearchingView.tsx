import { BookOpen, Brain, Code, Loader2, Sparkles, WifiOff, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";

import { MatchSearchingViewProps, TIER_METADATA } from "@/models/matching/matchingViewType";

export default function MatchSearchingView({
    topics,
    languages,
    difficulties,
    relaxationTier,
    onCancel,
    isConnected,
}: MatchSearchingViewProps) {
    const isRelaxed = relaxationTier > 0;
    const { title, description } = TIER_METADATA[relaxationTier] || TIER_METADATA[0];

    return (
        <CardContent className="p-8 sm:p-12 bg-gradient-to-br from-indigo-900 via-purple-900 to-violet-900 text-white flex flex-col items-center justify-center min-h-[500px]">
            {/* Pulsing Radar Animation */}
            <div className="relative flex items-center justify-center mb-10">
                {isConnected ? (
                    <>
                        <div
                            className="absolute inset-0 rounded-full bg-indigo-500/30 animate-ping"
                            style={{ animationDuration: "3s" }}
                        ></div>
                        <div
                            className="absolute inset-2 rounded-full bg-purple-500/40 animate-ping"
                            style={{ animationDuration: "2s" }}
                        ></div>
                        <div className="relative z-10 bg-white/10 p-5 rounded-full backdrop-blur-md border border-white/20">
                            <Loader2 className="size-12 animate-spin text-white" />
                        </div>
                    </>
                ) : (
                    <>
                        <div className="absolute inset-0 rounded-full bg-red-500/20"></div>
                        <div className="relative z-10 bg-red-500/20 p-5 rounded-full backdrop-blur-md border border-red-500/40">
                            <WifiOff className="size-12 text-red-200" />
                        </div>
                    </>
                )}
            </div>

            {/* Dynamic Status Message */}
            <div className="text-center mb-8">
                {isConnected ? (
                    <>
                        <h3
                            className={`text-2xl font-bold tracking-tight mb-2 flex items-center justify-center gap-2 transition-all duration-500 ${isRelaxed ? "text-yellow-300 scale-105" : "text-white"}`}
                        >
                            {isRelaxed && <Sparkles className="size-5 animate-pulse" />}
                            {title}
                        </h3>
                        <p className="text-indigo-200 max-w-[280px] mx-auto">{description}</p>
                    </>
                ) : (
                    <>
                        <h3 className="text-2xl font-bold tracking-tight mb-2 flex items-center justify-center gap-2 text-red-300">
                            Connection Lost
                        </h3>
                        <p className="text-red-200/80 max-w-[280px] mx-auto">
                            Waiting for network... your timer is paused.
                        </p>
                    </>
                )}
            </div>

            {/* Selected Settings Summary Box */}
            <div className="w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 mb-10 space-y-5 shadow-inner">
                {/* Topics */}
                <div className="flex items-start gap-3 text-indigo-100">
                    <BookOpen className="size-5 text-purple-300 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                        <span className="text-xs uppercase tracking-wider font-semibold opacity-60">
                            Topics
                        </span>
                        <span className="font-bold text-white leading-tight">
                            {topics.join(", ")}
                        </span>
                    </div>
                </div>

                {/* Difficulties */}
                <div className="flex items-start gap-3 text-indigo-100">
                    <Brain className="size-5 text-purple-300 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                        <span className="text-xs uppercase tracking-wider font-semibold opacity-60">
                            Difficulty
                        </span>
                        <span className="font-bold text-white leading-tight">
                            {difficulties.join(", ")}
                        </span>
                    </div>
                </div>

                {/* Languages */}
                <div className="flex items-start gap-3 text-indigo-100">
                    <Code className="size-5 text-purple-300 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                        <span className="text-xs uppercase tracking-wider font-semibold opacity-60">
                            Language
                        </span>
                        <span className="font-bold text-white leading-tight">
                            {languages.join(", ")}
                        </span>
                    </div>
                </div>
            </div>

            {/* Cancel Button */}
            <Button
                variant="destructive"
                className="h-14 w-full rounded-xl bg-red-500/90 hover:bg-red-600 text-lg font-semibold shadow-[0_10px_20px_rgba(239,68,68,0.2)] transition-all border border-red-400/50"
                onClick={onCancel}
            >
                <X className="size-5 mr-2" />
                Cancel Search
            </Button>
        </CardContent>
    );
}
