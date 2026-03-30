import { Flame, Rocket, Sprout, Trophy, Users, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxItem,
    ComboboxList,
    ComboboxValue,
    useComboboxAnchor,
} from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";

import { cn } from "@/lib/utils";
import { MatchFormViewProps } from "@/models/matching/matchingViewType";
import { Difficulty, Language } from "@/models/question/questionType";

const difficultyOptions = [
    {
        value: Difficulty.EASY,
        label: "Easy",
        icon: Sprout,
        activeClassName: "border-emerald-400 bg-emerald-50 text-emerald-700",
    },
    {
        value: Difficulty.MEDIUM,
        label: "Medium",
        icon: Flame,
        activeClassName: "border-amber-400 bg-amber-50 text-amber-700",
    },
    {
        value: Difficulty.HARD,
        label: "Hard",
        icon: Zap,
        activeClassName: "border-slate-900 bg-slate-900 text-white",
    },
] as const;

export default function MatchFormView({
    topicOptions,
    languageOptions,
    topics,
    setTopics,
    languages,
    setLanguages,
    difficulty,
    setDifficulty,
    onFindMatch,
    userScore,
}: MatchFormViewProps) {
    const topicAnchor = useComboboxAnchor();
    const languageAnchor = useComboboxAnchor();

    return (
        <CardContent className="p-6 sm:p-8 bg-white/90 transition-opacity">
            <div className="mb-8 flex items-start justify-between gap-6">
                <div className="space-y-3">
                    <div>
                        <h2 className="text-3xl font-extrabold tracking-tight text-slate-950">
                            Start a Practice Session
                        </h2>
                    </div>
                    {/* User Score Badge */}
                    <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 shadow-sm">
                        <div className="relative ">
                            <Trophy className="size-4 text-amber-500" />
                            <span className="absolute inset-0 size-4 bg-amber-400 blur-sm opacity-40 animate-pulse" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-600">
                            Your Rating:
                            <span className="text-sm ml-2 text-slate-950 font-black">
                                {userScore ?? "---"}
                            </span>
                        </span>
                    </div>
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
                    <Combobox
                        multiple
                        autoHighlight
                        items={topicOptions}
                        value={topics}
                        onValueChange={setTopics}
                    >
                        <ComboboxChips
                            ref={topicAnchor}
                            className="w-full min-h-14 rounded-xl border-2 border-slate-200 bg-white px-2 py-1 shadow-sm focus-within:border-indigo-400"
                        >
                            <ComboboxValue>
                                {(values: string[]) => (
                                    <>
                                        {values.map((val) => (
                                            <ComboboxChip
                                                key={val}
                                                className="bg-indigo-50 text-indigo-700 border-indigo-100"
                                            >
                                                {val}
                                            </ComboboxChip>
                                        ))}
                                        <ComboboxChipsInput
                                            placeholder="Type to search topics..."
                                            className="text-lg"
                                        />
                                    </>
                                )}
                            </ComboboxValue>
                        </ComboboxChips>
                        <ComboboxContent
                            anchor={topicAnchor}
                            className="w-[var(--anchor-width)] min-w-[var(--anchor-width)] bg-white rounded-xl shadow-2xl border-2 border-slate-200"
                        >
                            <ComboboxEmpty>No topics found.</ComboboxEmpty>
                            <ComboboxList>
                                {(item) => (
                                    <ComboboxItem key={item} value={item} className="text-lg py-3">
                                        {item}
                                    </ComboboxItem>
                                )}
                            </ComboboxList>
                        </ComboboxContent>
                    </Combobox>
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
                        Programming Languages
                    </Label>
                    <Combobox
                        multiple
                        autoHighlight
                        items={languageOptions}
                        value={languages}
                        onValueChange={setLanguages}
                    >
                        <ComboboxChips
                            ref={languageAnchor}
                            className="w-full min-h-14 rounded-xl border-2 border-slate-200 bg-white px-2 py-1 shadow-sm focus-within:border-indigo-400"
                        >
                            <ComboboxValue>
                                {(values: Language[]) => (
                                    <>
                                        {values.map((val) => (
                                            <ComboboxChip
                                                key={val}
                                                className="bg-violet-50 text-violet-700 border-violet-100"
                                            >
                                                {val}
                                            </ComboboxChip>
                                        ))}
                                        <ComboboxChipsInput
                                            placeholder="Type to search languages..."
                                            className="text-lg"
                                        />
                                    </>
                                )}
                            </ComboboxValue>
                        </ComboboxChips>
                        <ComboboxContent
                            anchor={languageAnchor}
                            className="w-[var(--anchor-width)] min-w-[var(--anchor-width)] bg-white rounded-xl shadow-2xl border-2 border-slate-200"
                        >
                            <ComboboxEmpty>No languages found.</ComboboxEmpty>
                            <ComboboxList>
                                {(item) => (
                                    <ComboboxItem key={item} value={item} className="text-lg py-3">
                                        {item}
                                    </ComboboxItem>
                                )}
                            </ComboboxList>
                        </ComboboxContent>
                    </Combobox>
                </div>

                {/* Submit Section */}
                <div className="space-y-4 pt-2">
                    <Button
                        disabled={
                            topics.length === 0 || languages.length === 0 || difficulty === null
                        }
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
