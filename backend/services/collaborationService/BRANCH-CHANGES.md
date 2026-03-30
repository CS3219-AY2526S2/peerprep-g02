# Changes in `integrate-attempts` Branch

## Summary

This branch adds **code execution** (Run Code / Submit Solution) and **attempt recording** to the collaboration system. It also introduces the **Execution Service** as a new microservice, removes PostgreSQL from the collaboration service, and updates the question/attempt schemas to support test case evaluation.

---

## New Microservice: Execution Service

A new service at `backend/services/executionService/` that wraps the **Piston** sandboxed code execution engine.

### API

```
POST /execute
Headers: x-internal-service-key: <key>
Body: { code, language, functionName, testCases }
```

**Response:**

```json
{
    "results": [
        {
            "testCaseIndex": 0,
            "passed": true,
            "actualOutput": "[0,1]",
            "expectedOutput": "[0,1]",
            "executionTimeMs": 1200
        }
    ],
    "totalTestCases": 2,
    "testCasesPassed": 1,
    "stderr": ""
}
```

### How it works

1. Wraps user code with a language-specific test harness (per-language templates in `languageRunners.ts`)
2. Passes all test cases via stdin as JSON
3. Calls Piston's `POST /api/v2/execute` in a single request (all test cases batched)
4. Parses the JSON results array from stdout
5. Compares actual vs expected output per test case

### Supported languages

| Language   | Piston Package | Version  |
| ---------- | -------------- | -------- |
| Python     | python         | 3.10.0   |
| JavaScript | node           | 18.15.0  |
| TypeScript | typescript     | 5.0.3    |
| Java       | java           | 15.0.2   |

### Files added

```
backend/services/executionService/
├── Dockerfile
├── package.json
├── tsconfig.json
├── .env.example
└── src/
    ├── index.ts
    ├── config/constants.ts          # PISTON_LANGUAGE_MAP, REQUIRED_RUNTIMES
    ├── config/env.ts                # pistonUrl, runTimeout, runMemoryLimit
    ├── middleware/internalServiceAuth.ts
    ├── routes/executeRoutes.ts      # POST /execute
    ├── services/executionService.ts  # Core Piston calling logic
    ├── services/languageRunners.ts   # Per-language wrapper code generation
    ├── services/pistonSetup.ts       # Runtime installation on startup
    └── utils/logger.ts
```

---

## Docker Compose Changes

### New services added

```yaml
# Piston sandboxed code execution engine
piston:
    image: ghcr.io/engineer-man/piston
    container_name: piston
    privileged: true
    volumes:
        - piston_data:/piston
    environment:
        - PISTON_RUN_TIMEOUT=10000
        - PISTON_RUN_MEMORY_LIMIT=134217728
        - PISTON_COMPILE_TIMEOUT=15000
        - PISTON_DISABLE_NETWORKING=true
        - PISTON_OUTPUT_MAX_SIZE=65536
    ports:
        - "2000:2000"

# Execution Service (Piston adapter)
execution-service:
    build: ./backend/services/executionService
    env_file:
        - ./backend/services/executionService/.env
    environment:
        - PISTON_URL=http://piston:2000
    depends_on:
        - piston
    ports:
        - "3006:3006"
```

### Updated services

- **collaboration-service**: Added env vars `CS_EXECUTION_SERVICE_URL=http://execution-service:3006` and `CS_ATTEMPT_SERVICE_URL=http://attempts-service:3004`
- **New volume**: `piston_data` for persisting installed runtimes

---

## Collaboration Service Changes

### Removed: PostgreSQL

- Deleted `src/repositories/postgresSessionRepository.ts`
- Deleted `src/utils/postgres.ts`
- Deleted `migrations/` directory (0001_create_sessions_table.sql, migrate.ts)
- Removed `pg` dependency from `package.json`
- All data is now Redis-only

### New services

| File | Purpose |
| ---- | ------- |
| `src/services/codeExecutionService.ts` | HTTP client that calls the Execution Service's `POST /execute` endpoint |
| `src/services/attemptRecordingService.ts` | HTTP client that calls the Attempt Service's `POST /attempts` endpoint |

### New env vars

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `CS_EXECUTION_SERVICE_URL` | `http://execution-service:3006` | Execution Service base URL |
| `CS_ATTEMPT_SERVICE_URL` | `http://attempts-service:3004` | Attempt Service base URL |
| `CS_QUESTION_DETAILS_PATH` | `/internal/get` | Question details endpoint path |

### New socket events

| Event | Direction | Description |
| ----- | --------- | ----------- |
| `code:run` | Client → Server | Execute code against test cases (no attempt recorded) |
| `code:submit` | Client → Server | Execute code + record attempt for both users |
| `code:running` | Server → Room | Broadcast when execution starts (triggers loading spinners) |
| `output:updated` | Server → Room | Broadcast with execution results or error |
| `submission:complete` | Server → Room | Broadcast after attempt is recorded |

### Socket handler changes (`registerSocketHandlers.ts`)

Added handlers for `code:run` and `code:submit`. Both follow the same pattern:

1. Broadcast `code:running` to room
2. Fetch session data + code + test cases from Redis
3. Call Execution Service
4. Store results in Redis (`output:{collaborationId}`)
5. Broadcast `output:updated` to room
6. (`code:submit` only) Record attempt via Attempt Service, broadcast `submission:complete`

Error handling broadcasts errors to the **entire room** (not just ack to requester) so all users' spinners stop.

### Redis changes

New fields cached in the session hash (`session:{collaborationId}`):

| Field | Type | Description |
| ----- | ---- | ----------- |
| `questionTitle` | string | Cached on first join for attempt recording |
| `testCases` | string | JSON array of `{ input, output }` for execution |
| `functionName` | string | Entry function name for code wrappers |

These are fetched from the Question Service on first user join and stored via `redisSessionRepository.storeQuestionDetails()`.

### New method: `getSessionForExecution()`

Added to `collaborationSessionService.ts`. Returns everything needed for code execution:
- Session metadata
- Current code from OT repository
- Cached test cases and function name from the session hash

---

## Attempt Service Changes

### New database migration

`migrations/0002_add_question_title_and_test_case_fields.sql`:

```sql
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS question_title TEXT NOT NULL DEFAULT '';
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS total_test_cases INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS test_cases_passed INTEGER NOT NULL DEFAULT 0;
```

### Updated `POST /attempts` payload

Three new required fields:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `questionTitle` | string | Human-readable question title |
| `totalTestCases` | number | Total number of test cases |
| `testCasesPassed` | number | Number of test cases that passed |

These are validated in the controller and stored with each attempt record.

---

## Question Service Changes

### Schema update (`QUDB.sql`)

- Added `function_name TEXT NOT NULL DEFAULT ''` column to the `questions` table
- Added `function_name` values for all seeded questions (e.g. `reverseString`, `hasCycle`, `romanToInt`, etc.)
- Updated `test_case` JSON format: inputs are now wrapped in arrays to support `...spread` in wrapper scripts (e.g. `"input": ["III"]` instead of `"input": "III"`)

### Internal API update (`/internal/get`)

Response now includes `functionName` field:

```json
{
    "data": {
        "question": {
            "questionId": "...",
            "title": "...",
            "difficulty": "...",
            "topics": [...],
            "testCase": [...],
            "functionName": "romanToInt"
        }
    }
}
```

### Port fix (`initDb.ts`)

Changed default `DB_PORT` from `5435` to `5432` (5435 is the host-mapped port, inside the container it's 5432).

---

## Frontend Changes

### New types (`collaborationType.ts`)

```typescript
type TestCaseResult = {
    testCaseIndex: number;
    passed: boolean;
    actualOutput: string;
    expectedOutput: string;
    error?: string;
    executionTimeMs: number;
};

type ExecutionResults = {
    results: TestCaseResult[];
    totalTestCases: number;
    testCasesPassed: number;
    stderr: string;
};

type SubmissionCompletePayload = {
    collaborationId: string;
    success: boolean;
    totalTestCases: number;
    testCasesPassed: number;
};
```

### New socket events (`collaborationSocketType.ts`)

Added: `CODE_RUN`, `CODE_SUBMIT`, `CODE_RUNNING`, `SUBMISSION_COMPLETE`

### Collaboration service client (`collaborationService.ts`)

Added `runCode(collaborationId)` and `submitCode(collaborationId)` methods.

### Session hook (`useCollaborationSession.ts`)

New state and handlers:
- `isExecuting` — loading state for Run/Submit buttons
- `executionResults` — parsed test case results
- `submissionResult` — submission outcome
- `runCode()` / `submitCode()` — callbacks
- Handlers for `code:running`, `output:updated`, `submission:complete` events

### Collaboration UI (`CollaborationSessionView.tsx`)

- **Run Code button** — calls `runCode()`, shows spinner while executing
- **Submit Solution button** — calls `submitCode()`, disabled after submission
- **Submission result banner** — green/amber banner showing pass/fail count
- **Test case table** — now shows actual output, expected output, and pass/fail status per test case
- **Stderr panel** — shows stderr output in red when present
- **Results summary** — shows X/Y passed count
- **Input display fix** — unwraps single-element arrays for cleaner display

### Attempt history UI (`AttemptHistoryView.tsx`)

- Shows `questionTitle` instead of `questionId` in the table
- New **Test Cases** column showing `testCasesPassed/totalTestCases`
- Updated column widths to fit the new column
- Search now includes `questionTitle`

### Attempt history type (`attemptHistoryType.ts`)

Added fields: `questionTitle`, `totalTestCases`, `testCasesPassed`

---

## Matching Service Changes

### Collaboration service client (`collaborationService.ts`)

Updated 409 `ACTIVE_SESSION_CONFLICT` handling: instead of failing, parses the response body and reuses the existing `collaborationId` from `details.collaborationId`. This allows re-matching when a previous session is still active.
