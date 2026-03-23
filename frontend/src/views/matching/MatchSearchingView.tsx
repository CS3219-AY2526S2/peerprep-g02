import { BookOpen, Brain, Code, Loader2, X, Sparkles } from "lucide-react";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MatchSearchingViewProps } from "@/models/matching/matchingViewType";

export default function MatchSearchingView({
    topic,
    languages,
    difficulties,
    relaxationTier,
    onCancel,
}: MatchSearchingViewProps) {
    const isRelaxed = relaxationTier > 0;

    return (
        <CardContent className="p-8 sm:p-12 bg-gradient-to-br from-indigo-900 via-purple-900 to-violet-900 text-white flex flex-col items-center justify-center min-h-[500px]">
            {/* Pulsing Radar Animation */}
            <div className="relative flex items-center justify-center mb-10">
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
            </div>

            {/* Dynamic Status Message */}
            <div className="text-center mb-8">
                <h3
                    className={`text-2xl font-bold tracking-tight mb-2 flex items-center justify-center gap-2 transition-all duration-500 ${isRelaxed ? "text-yellow-300 scale-105" : "text-white"}`}
                >
                    {isRelaxed && <Sparkles className="size-5 animate-pulse" />}
                    {isRelaxed ? "Relaxing Search Criteria..." : "Finding a Peer..."}
                </h3>
                <p className="text-indigo-200 max-w-[280px] mx-auto">
                    {isRelaxed
                        ? "Broadening search to find you a match faster."
                        : "Matching you with someone who has similar settings."}
                </p>
            </div>

            {/* Selected Settings Summary Box */}
            <div className="w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 mb-10 space-y-5 shadow-inner">
                {/* Topic */}
                <div className="flex items-start gap-3 text-indigo-100">
                    <BookOpen className="size-5 text-purple-300 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                        <span className="text-xs uppercase tracking-wider font-semibold opacity-60">
                            Topic
                        </span>
                        <span className="font-bold text-white">{topic}</span>
                    </div>
                </div>

                {/* Difficulties - Handles multiple levels */}
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

                {/* Languages - Handles multiple languages */}
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
