import { BookOpen, Brain, Code, Loader2, X } from "lucide-react";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MatchSearchingView({ topic, language, difficulty, onCancel }: any) {
    return (
        <CardContent className="p-8 sm:p-12 bg-gradient-to-br from-indigo-900 via-purple-900 to-violet-900 text-white flex flex-col items-center justify-center min-h-[500px]">
            {/* Pulsing Radar Animation */}
            <div className="relative flex items-center justify-center mb-10">
                <div className="absolute inset-0 rounded-full bg-indigo-500/30 animate-ping" style={{ animationDuration: '3s' }}></div>
                <div className="absolute inset-2 rounded-full bg-purple-500/40 animate-ping" style={{ animationDuration: '2s' }}></div>
                <div className="relative z-10 bg-white/10 p-5 rounded-full backdrop-blur-md border border-white/20">
                    <Loader2 className="size-12 animate-spin text-white" />
                </div>
            </div>

            <h3 className="text-2xl font-bold tracking-tight mb-2 text-center">
                Finding a Peer...
            </h3>
            <p className="text-indigo-200 text-center mb-8 max-w-[250px]">
                Matching you with someone who has similar settings.
            </p>

            {/* Selected Settings Summary Box */}
            <div className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 mb-10 space-y-4">
                <div className="flex items-center gap-3 text-indigo-100">
                    <BookOpen className="size-5 text-purple-300" />
                    <span className="font-medium">Topic:</span>
                    <span className="ml-auto font-bold text-white">{topic}</span>
                </div>
                <div className="flex items-center gap-3 text-indigo-100">
                    <Brain className="size-5 text-purple-300" />
                    <span className="font-medium">Difficulty:</span>
                    <span className="ml-auto font-bold text-white">{difficulty}</span>
                </div>
                <div className="flex items-center gap-3 text-indigo-100">
                    <Code className="size-5 text-purple-300" />
                    <span className="font-medium">Language:</span>
                    <span className="ml-auto font-bold text-white">{language}</span>
                </div>
            </div>

            {/* Cancel Button */}
            <Button 
                variant="destructive" 
                className="h-14 w-full rounded-xl bg-red-500/90 hover:bg-red-600 text-lg font-semibold shadow-[0_10px_20px_rgba(239,68,68,0.3)] transition-all border border-red-400"
                onClick={onCancel}
            >
                <X className="size-5 mr-2" />
                Cancel Search
            </Button>
        </CardContent>
    );
}
