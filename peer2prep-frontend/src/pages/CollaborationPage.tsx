import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    createSession,
    createSessionStub,
    type CollaborationSession,
    type CreateSessionPayload,
} from "@/services/collaborationApi";

type ChatMessage = {
    id: string;
    author: string;
    text: string;
    at: string;
};

const STUB_QUESTION = {
    title: "1. Two Sum",
    tags: ["Easy", "Array", "Hash Table"],
    description:
        "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    details:
        "You may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.",
    examples: [
        { input: "nums = [2,7,11,15], target = 9", output: "[0,1]" },
        { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
        { input: "nums = [3,3], target = 6", output: "[0,1]" },
    ],
    constraints: ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9"],
};

const starterCodeByLanguage: Record<string, string> = {
    javascript: `var twoSum = function(nums, target) {
  const map = new Map();

  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }

  return [];
};`,
    python: `def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        diff = target - n
        if diff in seen:
            return [seen[diff], i]
        seen[n] = i
    return []`,
    java: `import java.util.*;

class Solution {
  public int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> map = new HashMap<>();
    for (int i = 0; i < nums.length; i++) {
      int complement = target - nums[i];
      if (map.containsKey(complement)) {
        return new int[] { map.get(complement), i };
      }
      map.put(nums[i], i);
    }
    return new int[] {};
  }
}`,
};

const START_TIME_SECONDS = 25 * 60;

function getSessionPayloadFromUrl(): CreateSessionPayload {
    const params = new URLSearchParams(window.location.search);
    return {
        userAId: params.get("userA") ?? "alex-chen",
        userBId: params.get("userB") ?? "you",
        difficulty: params.get("difficulty") ?? "easy",
        language: params.get("language") ?? "javascript",
    };
}

function formatTimer(seconds: number): string {
    const mins = Math.floor(seconds / 60)
        .toString()
        .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
}

export default function CollaborationPage() {
    const [session, setSession] = useState<CollaborationSession | null>(null);
    const [isStubMode, setIsStubMode] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [timerSeconds, setTimerSeconds] = useState(START_TIME_SECONDS);
    const [language, setLanguage] = useState("javascript");
    const [code, setCode] = useState(starterCodeByLanguage.javascript);
    const [isPeerOnline, setIsPeerOnline] = useState(true);
    const [chatInput, setChatInput] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: "m1",
            author: "Alex Chen",
            text: "Should we use a hash map approach for O(n) time complexity?",
            at: "2 min ago",
        },
        {
            id: "m2",
            author: "You",
            text: "Yes, implementing it now. Check line 6.",
            at: "1 min ago",
        },
    ]);

    const sessionPayload = useMemo(() => getSessionPayloadFromUrl(), []);

    useEffect(() => {
        let alive = true;

        const setFromSession = (nextSession: CollaborationSession) => {
            setSession(nextSession);
            const nextLanguage = nextSession.language.toLowerCase();
            setLanguage(nextLanguage);
            setCode(starterCodeByLanguage[nextLanguage] ?? starterCodeByLanguage.javascript);
        };

        const boot = async () => {
            setError(null);

            if (import.meta.env.VITE_FORCE_COLLAB_STUB === "true") {
                if (!alive) return;
                setFromSession(createSessionStub(sessionPayload).session);
                setIsStubMode(true);
                return;
            }

            try {
                const apiResponse = await createSession(sessionPayload);
                if (!alive) return;
                setFromSession(apiResponse.session);
                setIsStubMode(false);
            } catch (apiError) {
                if (!alive) return;
                setFromSession(createSessionStub(sessionPayload).session);
                setIsStubMode(true);
                setError(
                    apiError instanceof Error
                        ? `Collaboration API unavailable. Running in stub mode. ${apiError.message}`
                        : "Collaboration API unavailable. Running in stub mode.",
                );
            }
        };

        void boot();
        return () => {
            alive = false;
        };
    }, [sessionPayload]);

    useEffect(() => {
        const interval = window.setInterval(() => {
            setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        return () => {
            window.clearInterval(interval);
        };
    }, []);

    const onChangeLanguage = (nextLanguage: string) => {
        setLanguage(nextLanguage);
        setCode(starterCodeByLanguage[nextLanguage] ?? starterCodeByLanguage.javascript);
    };

    const sendMessage = () => {
        const trimmed = chatInput.trim();
        if (trimmed.length === 0) {
            return;
        }

        setMessages((prev) => [
            ...prev,
            {
                id: `m-${Date.now()}`,
                author: "You",
                text: trimmed,
                at: "just now",
            },
        ]);
        setChatInput("");
    };

    return (
        <section className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,#1e3658_0%,#0a1220_35%,#070d19_100%)] text-slate-100">
            <header className="flex items-center justify-between border-b border-slate-700/70 bg-slate-900/60 px-4 py-3 backdrop-blur">
                <div className="flex items-center gap-3">
                    <div className="rounded-md bg-blue-600 px-2 py-1 text-xs font-bold">&lt;/&gt;</div>
                    <strong className="text-base">Peer2Prep</strong>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-300">{STUB_QUESTION.title.replace("1. ", "")}</span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-semibold">
                        {formatTimer(timerSeconds)}
                    </span>
                    <button
                        type="button"
                        className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500"
                    >
                        Exit Session
                    </button>
                </div>
            </header>

            <div className="grid min-h-[calc(100vh-60px)] grid-cols-1 lg:grid-cols-12">
                <aside className="border-b border-slate-700/70 p-4 lg:col-span-5 lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
                    <div className="mb-3 flex flex-wrap gap-2">
                        {STUB_QUESTION.tags.map((tag) => (
                            <span
                                key={tag}
                                className="rounded-full border border-slate-500 bg-slate-800 px-2 py-1 text-xs font-semibold"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>

                    <h1 className="mb-4 text-3xl font-bold">{STUB_QUESTION.title}</h1>
                    <h3 className="mb-2 text-xl font-semibold">Description</h3>
                    <p className="mb-2 text-slate-200">{STUB_QUESTION.description}</p>
                    <p className="mb-4 text-slate-300">{STUB_QUESTION.details}</p>

                    <h3 className="mb-2 text-xl font-semibold">Examples</h3>
                    <div className="mb-4 space-y-3">
                        {STUB_QUESTION.examples.map((example, index) => (
                            <Card key={example.input} className="border-slate-700 bg-slate-800/70 text-slate-100">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg">Example {index + 1}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-1 text-sm">
                                    <p>
                                        <strong>Input:</strong> {example.input}
                                    </p>
                                    <p>
                                        <strong>Output:</strong> {example.output}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <h3 className="mb-2 text-xl font-semibold">Constraints</h3>
                    <ul className="list-disc space-y-1 pl-5 text-slate-200">
                        {STUB_QUESTION.constraints.map((constraint) => (
                            <li key={constraint}>{constraint}</li>
                        ))}
                    </ul>
                </aside>

                <section className="flex min-h-[55vh] flex-col lg:col-span-7">
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-700/70 bg-slate-900/40 px-3 py-2">
                        <select
                            value={language}
                            onChange={(event) => onChangeLanguage(event.target.value)}
                            className="rounded-md border border-slate-500 bg-slate-800 px-2 py-1 text-sm"
                        >
                            <option value="javascript">JavaScript</option>
                            <option value="python">Python</option>
                            <option value="java">Java</option>
                        </select>

                        <span
                            className={`mr-auto text-sm font-semibold ${
                                isPeerOnline ? "text-emerald-400" : "text-amber-300"
                            }`}
                        >
                            {isPeerOnline ? "active" : "peer disconnected"}
                        </span>

                        <button
                            type="button"
                            onClick={() => setIsPeerOnline((prev) => !prev)}
                            className="rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-600"
                        >
                            {isPeerOnline ? "Simulate Disconnect" : "Simulate Rejoin"}
                        </button>
                        <button
                            type="button"
                            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                        >
                            Run Code
                        </button>
                    </div>

                    <textarea
                        className="h-[40vh] w-full flex-1 resize-none border-0 bg-black/90 p-4 font-mono text-sm text-slate-100 outline-none"
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                    />

                    <Card className="rounded-none border-0 border-t border-slate-700/70 bg-slate-900/40 text-slate-100">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Chat</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="max-h-40 space-y-3 overflow-y-auto pr-2">
                                {messages.map((message) => (
                                    <div key={message.id} className="text-sm">
                                        <div className="flex items-center gap-2">
                                            <strong>{message.author}</strong>
                                            <span className="text-xs text-slate-400">{message.at}</span>
                                        </div>
                                        <p className="text-slate-200">{message.text}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                                <Input
                                    placeholder="Type a message..."
                                    value={chatInput}
                                    onChange={(event) => setChatInput(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            sendMessage();
                                        }
                                    }}
                                    className="border-slate-600 bg-slate-800 text-slate-100"
                                />
                                <button
                                    type="button"
                                    onClick={sendMessage}
                                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                                >
                                    Send
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </section>
            </div>

            <footer className="flex flex-wrap items-center gap-2 border-t border-slate-700/70 bg-slate-950/80 px-4 py-2 text-xs text-slate-300">
                <span>Session: {session?.sessionId ?? "loading..."}</span>
                {isStubMode ? (
                    <span className="rounded-full border border-amber-500 bg-amber-900/40 px-2 py-0.5 text-amber-300">
                        Stub Mode
                    </span>
                ) : null}
                {error ? <span className="text-rose-300">{error}</span> : null}
            </footer>
        </section>
    );
}
