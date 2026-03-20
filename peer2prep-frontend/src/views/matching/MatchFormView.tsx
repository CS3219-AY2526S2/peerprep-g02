import { Rocket, Users } from "lucide-react";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Difficulty } from "@/models/question/questionType";

import { topicOptions, languageOptions, difficultyOptions } from "@/models/question/tempStubType";
import { MatchFormViewProps } from "@/models/matching/matchingViewType";

export default function MatchFormView({
    topic,
    setTopic,
    language,
    setLanguage,
    difficulty,
    setDifficulty,
    onFindMatch,
}: MatchFormViewProps) {
    return (
        <CardContent className="p-6 sm:p-8 bg-white/90 transition-opacity">
            <div className="mb-8 flex items-start justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-slate-950">
                        Start a Practice Session
                    </h2>
                </div>
                <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                    <Rocket className="size-7" />
                </div>
            </div>

            <div className="space-y-7">
                {/* Topic Select */}
                <div className="space-y-3">
                    <Label htmlFor="topic" className="text-sm font-semibold text-slate-700">
                        Select Topic
                    </Label>
                    <Select value={topic} onValueChange={setTopic}>
                        <SelectTrigger
                            id="topic"
                            className="w-full !h-14 rounded-xl border-2 border-slate-200 bg-white px-4 text-lg font-medium shadow-sm focus:ring-indigo-100 focus:border-indigo-400"
                        >
                            <SelectValue placeholder="Select a topic" />
                        </SelectTrigger>
                        <SelectContent className="bg-white rounded-xl border-slate-200 shadow-xl">
                            {topicOptions.map((opt) => (
                                <SelectItem key={opt} value={opt} className="text-lg py-3">
                                    {opt}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Difficulty Selection */}
                <div className="space-y-3">
                    <Label className="text-sm font-semibold text-slate-700">Difficulty Level</Label>
                    <div className="grid gap-3 sm:grid-cols-3">
                        {difficultyOptions.map((option) => {
                            const Icon = option.icon;
                            const isSelected = difficulty === option.value;

                            return (
                                <Button
                                    key={option.value}
                                    type="button"
                                    variant="outline"
                                    className={cn(
                                        "h-16 rounded-2xl border-2 text-xl font-semibold shadow-sm transition hover:border-slate-300 hover:bg-slate-50",
                                        isSelected
                                            ? option.activeClassName
                                            : "border-slate-200 bg-white text-slate-700",
                                    )}
                                    onClick={() => setDifficulty(option.value as Difficulty)}
                                >
                                    <Icon className="size-5 mr-2" />
                                    {option.label}
                                </Button>
                            );
                        })}
                    </div>
                </div>

                {/* Language Select */}
                <div className="space-y-3">
                    <Label htmlFor="language" className="text-sm font-semibold text-slate-700">
                        Programming Language
                    </Label>
                    <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger
                            id="language"
                            className="w-full !h-14 rounded-xl border-2 border-slate-200 bg-white px-4 text-lg font-medium shadow-sm focus:ring-indigo-100 focus:border-indigo-400"
                        >
                            <SelectValue placeholder="Select a language" />
                        </SelectTrigger>
                        <SelectContent className="bg-white rounded-xl border-slate-200 shadow-xl">
                            {languageOptions.map((opt) => (
                                <SelectItem key={opt} value={opt} className="text-lg py-3">
                                    {opt}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Submit Section */}
                <div className="space-y-4 pt-2">
                    <Button
                        className="h-16 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-lg font-semibold text-white shadow-[0_14px_30px_rgba(79,70,229,0.32)] hover:from-indigo-500 hover:to-violet-500 transition-all"
                        onClick={onFindMatch}
                    >
                        <Users className="size-5 mr-2" />
                        Find a Peer
                    </Button>
                </div>
            </div>
        </CardContent>
    );
}
