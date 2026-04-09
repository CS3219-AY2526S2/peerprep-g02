import { LoaderCircle, Play, Send } from "lucide-react";

import { Button } from "@/components/ui/button";

interface EditorToolbarProps {
    language: string;
    isExecuting: boolean;
    disabled: boolean;
    onRunCode: () => void;
    onSubmitCode: () => void;
}

export default function EditorToolbar({
    language,
    isExecuting,
    disabled,
    onRunCode,
    onSubmitCode,
}: EditorToolbarProps) {
    return (
        <div className="border-b border-white/10 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-lg font-medium text-slate-100">
                    {language}
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        size="lg"
                        className="rounded-2xl bg-emerald-500 px-5 text-white hover:bg-emerald-400"
                        disabled={disabled}
                        onClick={onRunCode}
                    >
                        {isExecuting ? (
                            <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                            <Play className="size-4" />
                        )}
                        Run Code
                    </Button>
                    <Button
                        size="lg"
                        className="rounded-2xl bg-blue-500 px-5 text-white hover:bg-blue-400"
                        disabled={disabled}
                        onClick={onSubmitCode}
                    >
                        {isExecuting ? (
                            <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                            <Send className="size-4" />
                        )}
                        Submit Solution
                    </Button>
                </div>
            </div>
        </div>
    );
}
