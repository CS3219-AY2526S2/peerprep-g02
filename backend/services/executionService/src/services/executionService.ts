import { env } from "@/config/env.js";
import { PISTON_LANGUAGE_MAP, type SupportedLanguage } from "@/config/constants.js";
import { generateCombinedSource } from "@/services/languageRunners.js";
import { logger } from "@/utils/logger.js";

export type TestCase = {
    input: unknown;
    output: unknown;
};

export type TestCaseResult = {
    testCaseIndex: number;
    passed: boolean;
    actualOutput: string;
    expectedOutput: string;
    error?: string;
    executionTimeMs: number;
};

export type ExecutionResponse = {
    results: TestCaseResult[];
    totalTestCases: number;
    testCasesPassed: number;
    stderr: string;
};

type PistonRunResult = {
    stdout: string;
    stderr: string;
    output: string;
    code: number | null;
    signal: string | null;
};

type PistonResponse = {
    language: string;
    version: string;
    run: PistonRunResult;
    compile?: PistonRunResult;
};

/** Result shape produced by our wrapper scripts (per test case). */
type WrapperResult = {
    output: string | null;
    error: string | null;
};

function normalizeForComparison(value: unknown): string {
    if (typeof value === "string") {
        try {
            return JSON.stringify(JSON.parse(value));
        } catch {
            return value.trim();
        }
    }
    return JSON.stringify(value);
}

export async function executeCode(
    code: string,
    language: SupportedLanguage,
    functionName: string,
    testCases: TestCase[],
): Promise<ExecutionResponse> {
    // Short-circuit when there is nothing to run
    if (!code || !code.trim()) {
        return {
            results: testCases.map((tc, i) => ({
                testCaseIndex: i,
                passed: false,
                actualOutput: "",
                expectedOutput: JSON.stringify(tc.output),
                error: "No code provided",
                executionTimeMs: 0,
            })),
            totalTestCases: testCases.length,
            testCasesPassed: 0,
            stderr: "",
        };
    }

    const pistonLang = PISTON_LANGUAGE_MAP[language];
    const combinedSource = generateCombinedSource(language, code, functionName);
    const stdinPayload = JSON.stringify(testCases);

    const startTime = Date.now();

    // Call Piston
    const pistonResponse = await fetch(`${env.pistonUrl}/api/v2/execute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            language: pistonLang.language,
            version: pistonLang.version,
            files: [{ content: combinedSource }],
            stdin: stdinPayload,
            run_timeout: env.runTimeout,
            run_memory_limit: env.runMemoryLimit,
            compile_timeout: 15_000,
        }),
    });

    if (!pistonResponse.ok) {
        const errorText = await pistonResponse.text().catch(() => "Unknown error");
        logger.error({ status: pistonResponse.status, errorText }, "Piston API error");
        throw new Error(`Piston API error: ${pistonResponse.status}`);
    }

    const piston = (await pistonResponse.json()) as PistonResponse;
    const wallTimeMs = Date.now() - startTime;

    // Check for compilation errors
    if (piston.compile && piston.compile.code !== 0 && piston.compile.code !== null) {
        return {
            results: testCases.map((tc, i) => ({
                testCaseIndex: i,
                passed: false,
                actualOutput: "",
                expectedOutput: JSON.stringify(tc.output),
                error: `Compilation error: ${piston.compile!.stderr || piston.compile!.output}`.trim(),
                executionTimeMs: 0,
            })),
            totalTestCases: testCases.length,
            testCasesPassed: 0,
            stderr: piston.compile.stderr,
        };
    }

    const runResult = piston.run;

    // Check for runtime-level failure (timeout, signal kill, etc.)
    if (runResult.signal === "SIGKILL" || runResult.code === null) {
        const errorMsg = runResult.stderr.includes("memory")
            ? "Memory limit exceeded"
            : "Time limit exceeded";
        return {
            results: testCases.map((tc, i) => ({
                testCaseIndex: i,
                passed: false,
                actualOutput: "",
                expectedOutput: JSON.stringify(tc.output),
                error: errorMsg,
                executionTimeMs: wallTimeMs,
            })),
            totalTestCases: testCases.length,
            testCasesPassed: 0,
            stderr: runResult.stderr,
        };
    }

    // Try to parse the wrapper's JSON output from stdout
    let wrapperResults: WrapperResult[];
    try {
        wrapperResults = JSON.parse(runResult.stdout.trim());
    } catch {
        // stdout wasn't valid JSON - likely a runtime error before results could be printed
        logger.warn(
            { stdout: runResult.stdout.slice(0, 500), stderr: runResult.stderr.slice(0, 500) },
            "Failed to parse wrapper output",
        );
        return {
            results: testCases.map((tc, i) => ({
                testCaseIndex: i,
                passed: false,
                actualOutput: runResult.stdout.slice(0, 200),
                expectedOutput: JSON.stringify(tc.output),
                error: runResult.stderr || "Runtime error - could not parse output",
                executionTimeMs: wallTimeMs,
            })),
            totalTestCases: testCases.length,
            testCasesPassed: 0,
            stderr: runResult.stderr,
        };
    }

    // Map wrapper results to our response format
    const results: TestCaseResult[] = testCases.map((tc, i) => {
        const wr = wrapperResults[i];
        if (!wr || wr.error) {
            return {
                testCaseIndex: i,
                passed: false,
                actualOutput: "",
                expectedOutput: JSON.stringify(tc.output),
                error: wr?.error ?? "No result for this test case",
                executionTimeMs: wallTimeMs,
            };
        }

        // wr.output is already JSON.stringify'd by the wrapper (e.g. "\"10101\"")
        // Parse it back to get the raw value for comparison
        let actualValue: unknown;
        try {
            actualValue = JSON.parse(wr.output!);
        } catch {
            actualValue = wr.output;
        }

        const actualNormalized = normalizeForComparison(actualValue);
        const expectedNormalized = normalizeForComparison(tc.output);
        const passed = actualNormalized === expectedNormalized;

        return {
            testCaseIndex: i,
            passed,
            actualOutput: String(actualValue ?? ""),
            expectedOutput: JSON.stringify(tc.output),
            executionTimeMs: wallTimeMs,
        };
    });

    const testCasesPassed = results.filter((r) => r.passed).length;

    return {
        results,
        totalTestCases: testCases.length,
        testCasesPassed,
        stderr: runResult.stderr,
    };
}
