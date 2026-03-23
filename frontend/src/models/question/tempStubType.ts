import { Flame, Sprout, Zap } from "lucide-react";
import { Difficulty } from "@/models/question/questionType";
export const difficultyOptions = [
    { value: Difficulty.EASY, label: "Easy", icon: Sprout, activeClassName: "border-emerald-400 bg-emerald-50 text-emerald-700" },
    { value: Difficulty.MEDIUM, label: "Medium", icon: Flame, activeClassName: "border-amber-400 bg-amber-50 text-amber-700" },
    { value: Difficulty.HARD, label: "Hard", icon: Zap, activeClassName: "border-slate-900 bg-slate-900 text-white" },
] as const;

export const topicOptions = ["Algorithms", "Array", "Data Structures", "Strings", "Bit Manipulation", "Recursion", "Databases"];
export const languageOptions = ["JavaScript", "TypeScript", "Python", "Java"];