import { CheckCircle2, Radio, TerminalSquare, XCircle } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { ExecutionResults } from "@/models/collaboration/collaborationType";

export interface TestRow {
    id: number;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    status: "passed" | "failed" | "pending";
    error?: string;
}

interface TestCasesPanelProps {
    testRows: TestRow[];
    executionOutput: string;
    executionResults: ExecutionResults | null;
}

export default function TestCasesPanel({
    testRows,
    executionOutput,
    executionResults,
}: TestCasesPanelProps) {
    return (
        <div className="border-b border-white/10 lg:border-r lg:border-b-0">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-3">
                    <TerminalSquare className="size-5 text-cyan-300" />
                    <h2 className="text-2xl font-semibold text-white">Test Cases</h2>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Radio className="size-4 text-emerald-400" />
                    {executionOutput ? "Output received" : "Execution shell ready"}
                </div>
            </div>

            {executionResults && (
                <div className="border-b border-white/10 bg-black/50 px-5 py-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-400">Results</span>
                        <span
                            className={cn(
                                "text-sm font-semibold",
                                executionResults.testCasesPassed === executionResults.totalTestCases &&
                                    executionResults.totalTestCases > 0
                                    ? "text-emerald-400"
                                    : "text-amber-400",
                            )}
                        >
                            {executionResults.testCasesPassed}/{executionResults.totalTestCases} passed
                        </span>
                    </div>
                </div>
            )}

            {executionResults?.stderr && (
                <div className="border-b border-white/10 bg-red-500/5 p-4">
                    <p className="mb-2 text-sm font-medium text-red-400">Stderr:</p>
                    <pre className="whitespace-pre-wrap font-mono text-sm text-red-300">
                        {executionResults.stderr}
                    </pre>
                </div>
            )}

            <div className="overflow-auto">
                <Table className="min-w-full text-left text-sm">
                    <TableHeader className="bg-white/[0.03] text-slate-400">
                        <TableRow className="border-0 hover:bg-transparent">
                            <TableHead className="px-5 py-3">Case</TableHead>
                            <TableHead className="px-5 py-3">Input</TableHead>
                            <TableHead className="px-5 py-3">Output</TableHead>
                            <TableHead className="px-5 py-3">Expected</TableHead>
                            <TableHead className="px-5 py-3">Result</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {testRows.length > 0 ? (
                            testRows.map((testRow) => (
                                <TableRow
                                    key={testRow.id}
                                    className="border-t border-white/5 text-slate-200 hover:bg-transparent"
                                >
                                    <TableCell className="px-5 py-4">{testRow.id}</TableCell>
                                    <TableCell className="max-w-[150px] truncate px-5 py-4 font-mono text-xs">
                                        {testRow.input}
                                    </TableCell>
                                    <TableCell className="max-w-[150px] px-5 py-4 font-mono text-xs">
                                        <span className="block truncate">
                                            {testRow.actualOutput ?? (testRow.error ? "" : "-")}
                                        </span>
                                        {testRow.error && (
                                            <span className="block truncate text-red-400">
                                                {testRow.error}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="max-w-[150px] truncate px-5 py-4 font-mono text-xs">
                                        {testRow.expectedOutput}
                                    </TableCell>
                                    <TableCell className="px-5 py-4">
                                        <span
                                            className={cn(
                                                "inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold",
                                                testRow.status === "passed"
                                                    ? "bg-emerald-500/15 text-emerald-300"
                                                    : testRow.status === "failed"
                                                      ? "bg-red-500/15 text-red-300"
                                                      : "bg-slate-500/15 text-slate-400",
                                            )}
                                        >
                                            {testRow.status === "passed" ? (
                                                <CheckCircle2 className="size-4" />
                                            ) : testRow.status === "failed" ? (
                                                <XCircle className="size-4" />
                                            ) : null}
                                            {testRow.status === "passed"
                                                ? "Passed"
                                                : testRow.status === "failed"
                                                  ? "Failed"
                                                  : "Pending"}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={5} className="px-5 py-10 text-center text-slate-500">
                                    No test cases loaded yet.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
