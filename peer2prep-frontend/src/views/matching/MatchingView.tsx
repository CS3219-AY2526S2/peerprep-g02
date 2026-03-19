import { useState } from "react";
import { Rocket, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { topicOptions, languageOptions, difficultyOptions, Difficulty } from "@/models/question/tempStubType";

export function MatchingView() {
    const [topic, setTopic] = useState(topicOptions[0]);
    const [language, setLanguage] = useState(languageOptions[0]);
    const [difficulty, setDifficulty] = useState<Difficulty>("easy");

    return (
        <Card className="rounded-[30px] border border-white/70 bg-white/90 py-0 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
            <CardContent className="p-6 sm:p-8">
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
                            <SelectTrigger id="topic" className="w-full !h-14 rounded-xl border-2 border-slate-200 bg-white px-4 text-lg font-medium shadow-sm focus:ring-indigo-100 focus:border-indigo-400">
                                <SelectValue placeholder="Select a topic" />
                            </SelectTrigger>
                            <SelectContent 
                                position="popper" 
                                sideOffset={4}
                                className="w-[var(--radix-select-trigger-width)] bg-white rounded-xl border-slate-200 shadow-xl"
                            >
                                {topicOptions.map((opt) => (
                                    <SelectItem key={opt} value={opt} className="text-lg py-3">
                                        {opt}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Difficulty Selection (Buttons) */}
                    <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700">
                            Difficulty Level
                        </Label>
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
                                        <Icon className="size-5" />
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
                            <SelectTrigger id="topic" className="w-full !h-14 rounded-xl border-2 border-slate-200 bg-white px-4 text-lg font-medium shadow-sm focus:ring-indigo-100 focus:border-indigo-400">
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
                        <Button className="h-16 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-lg font-semibold text-white shadow-[0_14px_30px_rgba(79,70,229,0.32)] hover:from-indigo-500 hover:to-violet-500">
                            <Users className="size-5" />
                            Find a Peer
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
