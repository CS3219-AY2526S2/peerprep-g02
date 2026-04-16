import type { SupportedLanguage } from "@/config/constants.js";

/**
 * Generates a combined source string that inlines the user's code and a test
 * harness. The harness reads a JSON array of test cases from stdin, calls the
 * user's function for each, and prints a JSON array of results to stdout.
 *
 * Each result element: { "output": "<json string>", "error": null | "<message>" }
 */
export function generateCombinedSource(
    language: SupportedLanguage,
    userCode: string,
    functionName: string,
): string {
    switch (language) {
        case "python":
            return generatePython(userCode, functionName);
        case "javascript":
            return generateJavaScript(userCode, functionName);
        case "typescript":
            return generateTypeScript(userCode, functionName);
        case "java":
            return generateJava(userCode, functionName);
    }
}

function generatePython(userCode: string, functionName: string): string {
    return `import json, sys

# --- User code ---
${userCode}
# --- End user code ---

# Resolve function: try global, then Solution().method
_fn = None
_resolve_error = None
try:
    if '${functionName}' in dir():
        _fn = ${functionName}
    elif 'Solution' in dir():
        _fn = getattr(Solution(), '${functionName}')
    else:
        _fn = ${functionName}
except Exception as _e:
    _resolve_error = str(_e)

_test_cases = json.loads(sys.stdin.read())
_results = []
if _resolve_error is not None:
    for _tc in _test_cases:
        _results.append({"output": None, "error": _resolve_error})
else:
    for _tc in _test_cases:
        _args = _tc["input"]
        if not isinstance(_args, list):
            _args = [_args]
        try:
            _r = _fn(*_args)
            _results.append({"output": json.dumps(_r), "error": None})
        except Exception as _e:
            _results.append({"output": None, "error": str(_e)})
print(json.dumps(_results))
`;
}

function generateJavaScript(userCode: string, functionName: string): string {
    return `const _fs = require('fs');

// --- User code ---
${userCode}
// --- End user code ---

const _input = _fs.readFileSync(0, 'utf8');
const _testCases = JSON.parse(_input);
const _solutionInstance = (typeof Solution !== 'undefined') ? new Solution() : null;
let _fn;
if (typeof ${functionName} === 'function') {
    _fn = ${functionName};
} else if (_solutionInstance && typeof _solutionInstance.${functionName} === 'function') {
    _fn = _solutionInstance.${functionName}.bind(_solutionInstance);
} else {
    _fn = ${functionName};
}
const _results = [];
for (const _tc of _testCases) {
    const _args = Array.isArray(_tc.input) ? _tc.input : [_tc.input];
    try {
        const _r = _fn(..._args);
        _results.push({ output: _r === undefined ? "null" : JSON.stringify(_r), error: null });
    } catch (_e) {
        _results.push({ output: null, error: String(_e) });
    }
}
console.log(JSON.stringify(_results));
`;
}

function generateTypeScript(userCode: string, functionName: string): string {
    return `const _fs = require('fs');

// --- User code ---
${userCode}
// --- End user code ---

const _input = _fs.readFileSync(0, 'utf8');
const _testCases = JSON.parse(_input);
const _fn = typeof ${functionName} === 'function'
    ? ${functionName}
    : typeof Solution !== 'undefined'
        ? new Solution().${functionName}.bind(new Solution())
        : ${functionName};
const _results: Array<{ output: string | null; error: string | null }> = [];
for (const _tc of _testCases) {
    const _args = Array.isArray(_tc.input) ? _tc.input : [_tc.input];
    try {
        const _r = _fn(..._args);
        _results.push({ output: _r === undefined ? "null" : JSON.stringify(_r), error: null });
    } catch (_e) {
        _results.push({ output: null, error: String(_e) });
    }
}
console.log(JSON.stringify(_results));
`;
}

function generateJava(userCode: string, functionName: string): string {
    return `${userCode}

class Runner {
    public static void main(String[] args) throws Exception {
        java.util.Scanner sc = new java.util.Scanner(System.in);
        StringBuilder sb = new StringBuilder();
        while (sc.hasNextLine()) sb.append(sc.nextLine());
        String input = sb.toString().trim();

        Solution solution = new Solution();
        java.lang.reflect.Method method = null;
        for (java.lang.reflect.Method m : Solution.class.getDeclaredMethods()) {
            if (m.getName().equals("${functionName}")) {
                method = m;
                break;
            }
        }
        if (method == null) {
            System.out.println("[{\\"output\\":null,\\"error\\":\\"Method ${functionName} not found\\"}]");
            return;
        }

        try {
            Object result = method.invoke(solution, (Object) input);
            System.out.println("[{\\"output\\":\\"" + String.valueOf(result).replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"") + "\\",\\"error\\":null}]");
        } catch (Exception e) {
            String err = e.getCause() != null ? e.getCause().getMessage() : e.getMessage();
            System.out.println("[{\\"output\\":null,\\"error\\":\\"" + (err != null ? err.replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"") : "Unknown error") + "\\"}]");
        }
    }
}
`;
}
