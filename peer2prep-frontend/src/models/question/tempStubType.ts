import { Flame, Sprout, Zap } from "lucide-react";

export const difficultyOptions = [
    { value: "easy", label: "Easy", icon: Sprout, activeClassName: "border-emerald-400 bg-emerald-50 text-emerald-700" },
    { value: "medium", label: "Medium", icon: Flame, activeClassName: "border-amber-400 bg-amber-50 text-amber-700" },
    { value: "hard", label: "Hard", icon: Zap, activeClassName: "border-slate-900 bg-slate-900 text-white" },
] as const;

export type Difficulty = (typeof difficultyOptions)[number]["value"];

export const topicOptions = ["Arrays & Strings", "Trees & Graphs", "Dynamic Programming", "System Design"];
export const languageOptions = ["JavaScript", "TypeScript", "Python", "Java"];