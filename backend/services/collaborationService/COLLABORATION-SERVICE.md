# Collaboration Service Documentation

## Overview

The Collaboration Service enables real-time collaborative coding sessions between two matched users.
It handles session creation, real-time code synchronization using Operational Transformation (OT),
presence management, code execution (via the Execution Service + Piston), attempt recording (via the Attempt Service),
and full session lifecycle management. All runtime data is stored in Redis (no PostgreSQL).

---

## Table of Contents

1. [Architecture](#architecture)
2. [User Flow](#user-flow)
3. [REST API Endpoints](#rest-api-endpoints)
4. [Socket Events](#socket-events)
5. [Redis Data Model](#redis-data-model)
6. [Code Execution](#code-execution)
7. [Attempt Recording](#attempt-recording)
8. [Operational Transformation (OT)](#operational-transformation-ot)
9. [Configuration](#configuration)
10. [Data Models](#data-models)
11. [Error Codes](#error-codes)
12. [Files Reference](#files-reference)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  CollaborationSessionView.tsx 
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │ useCollaborationSession │  │    OTClient      │  │   UI Components   │   │
│  │ - connection mgmt   │  │ - local operations │  │ - Editor          │     │
│  │ - event handlers    │  │ - server sync      │  │ - Presence        │     │
│  │ - state management  │  │ - offline changes  │  │ - Question        │     │ 
│  │ - run/submit code   │  │                    │  │ - Test Results    │     │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                    │ HTTP (REST)              │ WebSocket (Socket.IO)
                    ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COLLABORATION SERVICE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes                                   Sockets                           │
│  ┌────────────────────┐                   ┌────────────────────────────┐    │
│  │ POST /sessions     │                   │ registerSocketHandlers.ts  │    │
│  │ GET  /health       │                   │ - session:join/leave       │    │
│  │ (internal only)    │                   │ - code:change              │    │
│  └────────────────────┘                   │ - code:run / code:submit   │    │
│                                           │ - presence events          │    │
│                                           └────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Services                                                                   │
│  ┌──────────────────────────┐  ┌──────────────────────────────────────┐     │
│  │CollaborationSessionService│  │      OTDocumentManager (OTService)  │     │
│  │ - createSession()        │  │ - getDocument() / initDocument()     │     │
│  │ - joinSession()          │  │ - applyClientOperations()            │     │
│  │ - leaveSession()         │  │ - transform()                        │     │
│  │ - getSessionForExecution()│  │ - deleteDocument()                   │     │
│  │ - endSession()           │  └──────────────────────────────────────┘     │
│  └──────────────────────────┘                                               │
│  ┌──────────────────────────┐  ┌──────────────────────────────────────┐     │
│  │ CodeExecutionService     │  │ AttemptRecordingService              │     │
│  │ - execute()              │  │ - recordAttempt()                    │     │
│  │ → calls Execution Svc   │  │ → calls Attempt Svc                  │     │
│  └──────────────────────────┘  └──────────────────────────────────────┘     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Repositories (all Redis-backed)                                             │
│  ┌────────────────────────────┐  ┌──────────────────────────────────────┐   │
│  │ RedisSessionRepository     │  │ RedisPresenceRepository              │   │
│  │ - session metadata         │  │ - socket bindings                    │   │
│  │ - user pair lookups        │  │ - presence state per user            │   │
│  │ - idempotency keys         │  │ - left users tracking                │   │
│  │ - question detail cache    │  │ - session activity timestamps        │   │
│  └────────────────────────────┘  └──────────────────────────────────────┘   │
│  ┌────────────────────────────┐  ┌──────────────────────────────────────┐   │
│  │ RedisOTRepository          │  │ RedisOutputRepository                │   │
│  │ - document content         │  │ - execution output/results cache     │   │
│  │ - revision numbers         │  └──────────────────────────────────────┘   │
│  │ - operation history        │                                             │
│  └────────────────────────────┘                                             │
└─────────────────────────────────────────────────────────────────────────────┘
         │                    │                     │                   │
         ▼                    ▼                     ▼                   ▼
┌──────────────┐   ┌────────────────┐   ┌────────────────┐   ┌──────────────┐
│    Redis     │   │ User Service   │   │Question Service│   │ Execution    │
│ - Sessions   │   │ - JWT auth     │   │ - Selection    │   │   Service    │
│ - Presence   │   │ - Batch valid. │   │ - Details      │   │ → Piston     │
│ - OT docs    │   └────────────────┘   └────────────────┘   └──────────────┘
│ - Output     │                                                     │
└──────────────┘                                              ┌──────────────┐
                                                              │ Attempt Svc  │
                                                              │ - Record     │
                                                              └──────────────┘
```

---

## User Flow

### 1. Session Creation

```
Matching Service                    Collaboration Service
     │                                      │
     │ POST /sessions                       │
     │ { matchId, userAId, userBId,         │
     │   difficulty, language, topic }      │
     │──────────────────────────────────────▶│
     │                                      │
     │                            ┌─────────┴─────────┐
     │                            │ 1. Validate payload │
     │                            │ 2. Validate users   │◄── User Service
     │                            │ 3. Select question  │◄── Question Service
     │                            │ 4. Create session   │
     │                            │ 5. Init OT doc      │
     │                            │ 6. Cache in Redis   │
     │                            └─────────┬─────────┘
     │                                      │
     │◀─────────────────────────────────────│
     │ 201 { session, idempotentHit }       │
```

### 2. Joining a Session

```
User A                              Collaboration Service
  │                                        │
  │ WebSocket connect (with JWT)           │
  │────────────────────────────────────────▶│
  │                                        │ Validate JWT via User Service
  │◀────────────────────────────────────────│
  │ connection:ready { userId }            │
  │                                        │
  │ session:join { collaborationId }       │
  │────────────────────────────────────────▶│
  │                            ┌───────────┴───────────┐
  │                            │ 1. Validate session    │
  │                            │ 2. Check user assigned │
  │                            │ 3. Fetch & cache Q     │
  │                            │ 4. Add to Socket room  │
  │                            │ 5. Update presence     │
  │                            └───────────┬───────────┘
  │◀────────────────────────────────────────│
  │ { ok: true, state: { session,          │
  │   question, codeSnapshot,              │
  │   codeRevision, participants } }       │
  │                                        │
  │                     ┌──────────────────┤
  │                     │ Broadcast to room │
  │                     └──────────────────┤
  │                                        │──────▶ user:joined to User B
  │                                        │──────▶ presence:updated to room
```

### 3. Real-time Code Collaboration

```
User A                          Server                          User B
  │                               │                               │
  │ Types "X" at position 10      │                               │
  │                               │                               │
  │ code:change                   │                               │
  │ { rev: 5, ops: [insert X@10] }│                               │
  │──────────────────────────────▶│                               │
  │                               │ 1. Transform vs recent ops    │
  │                               │ 2. Apply to OT document       │
  │                               │ 3. Store in history           │
  │◀──────────────────────────────│                               │
  │ ack { ok: true, rev: 6 }     │                               │
  │                               │──────────────────────────────▶│
  │                               │ code:change                   │
  │                               │ { rev: 6, ops: [insert X@10] }│
```

### 4. Code Execution (Run / Submit)

```
User A                          Server                          User B
  │                               │                               │
  │ code:run (or code:submit)     │                               │
  │──────────────────────────────▶│                               │
  │                               │──── code:running ────────────▶│
  │◀──── code:running ────────────│                               │
  │                               │                               │
  │                    ┌──────────┴──────────┐                    │
  │                    │ 1. Get session data  │                    │
  │                    │ 2. Get code from OT  │                    │
  │                    │ 3. Get test cases    │                    │
  │                    │ 4. Call Exec Service │                    │
  │                    │    → Piston          │                    │
  │                    │ 5. Store output      │                    │
  │                    └──────────┬──────────┘                    │
  │                               │                               │
  │◀──── output:updated ──────────│──── output:updated ──────────▶│
  │ { results, testCasesPassed }  │                               │
  │                               │                               │
  │ [If code:submit]              │                               │
  │                    ┌──────────┴──────────┐                    │
  │                    │ 6. Record attempt   │                    │
  │                    │    → Attempt Service │                    │
  │                    └──────────┬──────────┘                    │
  │◀── submission:complete ───────│── submission:complete ────────▶│
```

### 5. Handling Disconnections

```
User A disconnects               Server                          User B
  │                               │                               │
  │ ✕ (connection lost)           │                               │
  │                               │ 1. Detect via ping timeout    │
  │                               │ 2. Set A → "disconnected"     │
  │                               │ 3. Session stays "active"     │
  │                               │──────────────────────────────▶│
  │                               │ user:disconnected { userId: A }│
  │                               │                               │
  │                               │ User B can continue editing   │
```

### 6. Rejoining After Disconnection

```
User A reconnects                Server                          User B
  │                               │                               │
  │ session:join (within 30s)     │                               │
  │──────────────────────────────▶│                               │
  │                               │ 1. Check grace period (30s)   │
  │                               │ 2. Return authoritative state │
  │◀──────────────────────────────│                               │
  │ { codeSnapshot, codeRevision, │                               │
  │   wasDisconnected: true }     │──────────────────────────────▶│
  │                               │ user:joined { wasDisconnected }│
  │                               │                               │
  │ [If offline changes exist]    │                               │
  │ UI shows: "Submit/Discard?"   │                               │
```

### 7. Leaving and Session Termination

```
User A                          Server                          User B
  │                               │                               │
  │ session:leave                 │                               │
  │──────────────────────────────▶│                               │
  │                               │ 1. Mark A as "left"           │
  │                               │ 2. Check if both left         │
  │                               │──────────────────────────────▶│
  │                               │ user:left { userId: A }       │
  │                               │                               │
  │                               │ [If B also leaves]            │
  │                               │ session:ended                 │
  │                               │ { reason: "both_users_left" } │
```

Session also ends on inactivity timeout (default 30 min).

---

## REST API Endpoints

### `GET /health`

Health check endpoint (no auth required).

**Response (200):**

```json
{ "status": "ok", "service": "collaboration-service" }
```

### `POST /sessions`

Creates a new collaboration session. Called internally by the Matching Service.

**Headers:**

```
Content-Type: application/json
x-internal-service-key: <internal-service-key>
```

**Request Body:**

```json
{
    "matchId": "match-123",
    "userAId": "user_abc",
    "userBId": "user_def",
    "difficulty": "Medium",
    "language": "python",
    "topic": "arrays"
}
```

| Field        | Type   | Required | Description                            |
| ------------ | ------ | -------- | -------------------------------------- |
| `matchId`    | string | No       | Match identifier from Matching Service |
| `userAId`    | string | Yes      | First user's ID                        |
| `userBId`    | string | Yes      | Second user's ID                       |
| `difficulty` | enum   | Yes      | `Easy`, `Medium`, or `Hard`            |
| `language`   | string | Yes      | Programming language                   |
| `topic`      | string | Yes      | Question topic                         |

**Success Response (201 Created):**

```json
{
    "session": {
        "collaborationId": "4f0d95c6-b6e7-4c0e-b38f-2dd5332ed7d7",
        "matchId": "match-123",
        "userAId": "user_abc",
        "userBId": "user_def",
        "difficulty": "Medium",
        "language": "python",
        "topic": "arrays",
        "questionId": "q-123",
        "status": "active",
        "createdAt": "2026-03-21T15:00:00.000Z"
    },
    "idempotentHit": false,
    "cacheWriteSucceeded": true
}
```

**Idempotent Response (200 OK):** Returns existing session if same parameters match.

**Error Responses:**

| Status | Error Code                      | Description                             |
| ------ | ------------------------------- | --------------------------------------- |
| 400    | `INVALID_SESSION_REQUEST`       | Missing/invalid fields                  |
| 401    | `UNAUTHORIZED_INTERNAL_REQUEST` | Invalid internal service key            |
| 409    | `ACTIVE_SESSION_CONFLICT`       | Active session already exists for pair  |
| 424    | `USER_VALIDATION_FAILED`        | One or both users not active            |
| 424    | `QUESTION_NOT_FOUND`            | No question available for criteria      |
| 503    | `USER_SERVICE_UNAVAILABLE`      | User Service down                       |
| 503    | `QUESTION_SERVICE_UNAVAILABLE`  | Question Service down                   |

The 409 response includes the existing session's ID so callers can reuse it:

```json
{
    "error": "ACTIVE_SESSION_CONFLICT",
    "details": { "collaborationId": "existing-collab-id" }
}
```

---

## Socket Events

### Connection & Authentication

Socket connections require a valid JWT token:

```typescript
const socket = io(url, {
    auth: { token: "Bearer <jwt>" },
    // OR
    extraHeaders: { authorization: "Bearer <jwt>" },
});
```

The server validates the JWT via the User Service (`GET {userServiceUrl}/users/internal/authz/context`) and sets `socket.data.userId`.

### Server → Client

| Event                | Payload                                                                     | Description                              |
| -------------------- | --------------------------------------------------------------------------- | ---------------------------------------- |
| `connection:ready`   | `{ userId }`                                                                | Socket authenticated                     |
| `user:joined`        | `{ collaborationId, userId, isFirstConnection, wasDisconnected }`           | User joined the room                     |
| `user:disconnected`  | `{ collaborationId, userId, reason }`                                       | User's last socket disconnected          |
| `user:left`          | `{ collaborationId, userId }`                                               | User intentionally left                  |
| `presence:updated`   | `{ collaborationId, participants[] }`                                       | Presence state changed                   |
| `code:change`        | `{ collaborationId, userId, revision, operations[] }`                       | Remote OT operations (broadcast)         |
| `code:sync`          | `{ collaborationId, code, revision }`                                       | Full document re-sync for out-of-date client |
| `code:running`       | `{ collaborationId }`                                                       | Code execution started                   |
| `output:updated`     | `{ collaborationId, output }`                                               | Execution results (or error)             |
| `submission:complete` | `{ collaborationId, success, totalTestCases, testCasesPassed }`            | Attempt recorded after submit            |
| `session:ended`      | `{ collaborationId, reason }`                                               | Session terminated                       |

### Client → Server

| Event           | Payload                                           | Ack Response                                                                  |
| --------------- | ------------------------------------------------- | ----------------------------------------------------------------------------- |
| `session:join`  | `{ collaborationId }`                             | `{ ok, state?, error?, message? }`                                            |
| `session:leave` | `{ collaborationId }`                             | `{ ok }`                                                                      |
| `code:change`   | `{ collaborationId, revision, operations[] }`     | `{ ok, revision?, error? }`                                                   |
| `code:run`      | `{ collaborationId }`                             | `{ ok, error? }`                                                              |
| `code:submit`   | `{ collaborationId }`                             | `{ ok, error? }`                                                              |

### Join State (ack payload on `session:join`)

```json
{
    "ok": true,
    "state": {
        "session": {
            "collaborationId": "collab-123",
            "userAId": "user_abc",
            "userBId": "user_def",
            "difficulty": "Medium",
            "language": "python",
            "topic": "arrays",
            "questionId": "q-123",
            "status": "active",
            "createdAt": "2026-03-21T12:00:00.000Z"
        },
        "question": {
            "quid": "q-123",
            "title": "Two Sum",
            "topics": ["arrays"],
            "difficulty": "Medium",
            "description": "Given an array...",
            "testCase": [
                { "input": [[2,7,11,15], 9], "output": [0,1] }
            ]
        },
        "codeSnapshot": "",
        "codeRevision": 0,
        "participants": [
            { "userId": "user_abc", "status": "connected", "connectionCount": 1 }
        ],
        "isFirstConnection": true,
        "wasDisconnected": false,
        "disconnectDurationMs": 0
    }
}
```

### Output Updated Payload

The `output:updated` event carries execution results or an error:

**Success:**

```json
{
    "collaborationId": "collab-123",
    "output": {
        "results": [
            {
                "testCaseIndex": 0,
                "passed": true,
                "actualOutput": "[0,1]",
                "expectedOutput": "[0,1]",
                "executionTimeMs": 1200
            },
            {
                "testCaseIndex": 1,
                "passed": false,
                "actualOutput": "[1,2]",
                "expectedOutput": "[0,2]",
                "executionTimeMs": 1200
            }
        ],
        "totalTestCases": 2,
        "testCasesPassed": 1,
        "stderr": ""
    }
}
```

**Error:**

```json
{
    "collaborationId": "collab-123",
    "output": { "error": "Code execution failed." }
}
```

---

## Redis Data Model

All keys are auto-prefixed with `CS_REDIS_KEY_PREFIX` (default: `collaboration-service:`).
All keys have TTL = `CS_SESSION_TTL_MS` (default: 1 hour).

### Key Schema

```
collaboration-service:
├── session:{collaborationId}              # Hash: session metadata + cached question details
├── session:pair:{userA}:{userB}           # String → collaborationId (active pair lookup)
├── session:idempotency:{compositeKey}     # String → collaborationId
├── ot:{collaborationId}:content           # String: full code document
├── ot:{collaborationId}:revision          # String: integer revision number
├── ot:{collaborationId}:ops               # List: recent OT operations (max 50, newest first)
├── output:{collaborationId}               # String: JSON-serialized execution results
├── presence:{collaborationId}:{userId}    # Hash: user presence state
├── presence:{collaborationId}:sockets     # Set: socket IDs in this session
├── socket:{socketId}                      # Hash: {collaborationId, userId}
├── left:{collaborationId}                 # Set: user IDs who intentionally left
├── activity:{collaborationId}             # String: last activity timestamp (unix ms)
└── collab:session:{collaborationId}       # Hash: session cache (SessionCacheRepository)
```

### Session Hash Fields

`session:{collaborationId}`:

| Field            | Type   | Description                                    |
| ---------------- | ------ | ---------------------------------------------- |
| `collaborationId`| string | UUID                                           |
| `matchId`        | string | Match ID from matching service                 |
| `userAId`        | string | First user's Clerk ID                          |
| `userBId`        | string | Second user's Clerk ID                         |
| `difficulty`     | string | Easy / Medium / Hard                           |
| `language`       | string | python / javascript / typescript / java        |
| `topic`          | string | Question topic                                 |
| `questionId`     | string | Selected question ID                           |
| `status`         | string | active / inactive                              |
| `createdAt`      | string | ISO timestamp                                  |
| `questionTitle`  | string | Cached on first join (for attempt recording)   |
| `testCases`      | string | JSON array of `{ input, output }` (cached)     |
| `functionName`   | string | Entry function name for code execution (cached) |

### Presence Hash Fields

`presence:{collaborationId}:{userId}`:

| Field                | Type   | Description                                |
| -------------------- | ------ | ------------------------------------------ |
| `userId`             | string | User ID                                    |
| `status`             | string | connected / disconnected / left            |
| `socketCount`        | string | Number of active sockets                   |
| `lastActivityTime`   | string | Unix ms timestamp                          |
| `lastDisconnectTime` | string | Unix ms timestamp (set on disconnect)      |

### OT Operation List Entry

Each element in `ot:{collaborationId}:ops` is a JSON object:

```json
{
    "userId": "user_abc",
    "revision": 5,
    "clientOps": [{ "type": "insert", "position": 0, "text": "X" }],
    "serverOps": [{ "type": "insert", "position": 0, "text": "X" }]
}
```

The OT repository uses a Lua script for atomic updates: SET content + SET revision + LPUSH op + LTRIM to 50 + PEXPIRE all keys — only if the current revision matches the expected value (optimistic concurrency).

---

## Code Execution

### Overview

Code execution is handled by the **Execution Service**, which uses **Piston** as the sandboxed code runner. The collaboration service is a thin orchestrator.

### Flow

1. Client emits `code:run` or `code:submit`
2. Collaboration service broadcasts `code:running` to the room
3. `collaborationSessionService.getSessionForExecution()` reads:
   - Session metadata from Redis
   - Current code from `ot:{collaborationId}:content`
   - Cached `testCases` and `functionName` from the session hash
4. `codeExecutionService.execute()` makes an HTTP call:

```
POST {CS_EXECUTION_SERVICE_URL}/execute
Headers: x-internal-service-key: <key>
Body: { code, language, functionName, testCases }
```

5. The Execution Service wraps user code with a language-specific test harness, sends it to Piston (`POST /api/v2/execute`), parses results
6. Results are stored in Redis at `output:{collaborationId}`
7. `output:updated` is broadcast to the entire room

### Supported Languages

| Language   | Piston Runtime | Version  |
| ---------- | -------------- | -------- |
| Python     | python         | 3.10.0   |
| JavaScript | node           | 18.15.0  |
| TypeScript | typescript     | 5.0.3    |
| Java       | java           | 15.0.2   |

### Execution Service Response Format

```typescript
type ExecutionResponse = {
    results: {
        testCaseIndex: number;
        passed: boolean;
        actualOutput: string;
        expectedOutput: string;
        error?: string;
        executionTimeMs: number;
    }[];
    totalTestCases: number;
    testCasesPassed: number;
    stderr: string;
};
```

### Error Broadcasting

If execution fails at any point, an error payload is broadcast to the **entire room** (not just ack'd to the requester), so all users' loading spinners stop:

```json
{ "collaborationId": "...", "output": { "error": "Code execution failed." } }
```

---

## Attempt Recording

### Overview

When a user clicks **Submit** (emits `code:submit`), code is executed first, then an attempt is recorded for **both users** via the Attempt Service.

### Flow

1. Code is executed (same as `code:run` flow above)
2. Success is determined: `testCasesPassed === totalTestCases && totalTestCases > 0`
3. Duration is calculated: `(Date.now() - session.createdAt) / 1000` in seconds
4. `attemptRecordingService.recordAttempt()` calls:

```
POST {CS_ATTEMPT_SERVICE_URL}/attempts
Headers: x-internal-service-key: <key>
Body: {
    userAId, userBId, questionId, questionTitle,
    language, difficulty, success, duration,
    totalTestCases, testCasesPassed
}
```

5. On success, `submission:complete` is broadcast to the room:

```json
{
    "collaborationId": "collab-123",
    "success": true,
    "totalTestCases": 3,
    "testCasesPassed": 3
}
```

6. If attempt recording fails, execution results are still shown but the ack returns:
   `{ ok: false, error: "Code executed but failed to record attempt." }`

### Question Detail Caching

Test cases and function names are fetched from the Question Service on first join and cached in the session Redis hash (`questionTitle`, `testCases`, `functionName`). This avoids re-fetching on every execution.

---

## Operational Transformation (OT)

### Operation Types

| Type     | Fields              | Description                         |
| -------- | ------------------- | ----------------------------------- |
| `insert` | `position`, `text`  | Insert text at position             |
| `delete` | `position`, `count` | Delete count characters at position |
| `retain` | `position`, `count` | Skip count characters (no-op)       |

### Client State Machine

```
                    ┌─────────────────┐
                    │  synchronized   │
                    └────────┬────────┘
                             │
                     local operation
                             │
                             ▼
                    ┌─────────────────┐
            ┌───────│  awaitingAck    │───────┐
            │       └─────────────────┘       │
            │                                 │
     local operation                    server ack
            │                                 │
            ▼                                 ▼
   ┌────────────────────┐           ┌─────────────────┐
   │ awaitingAckWithBuffer│◀────────│  synchronized   │
   └────────────────────┘           └─────────────────┘
            │
      server ack
            │
            ▼
   ┌─────────────────┐
   │  awaitingAck    │  (sends buffer)
   └─────────────────┘
```

### Server-side OT

The `OTDocumentManager` performs:

1. Fetch current document + recent operations from Redis
2. Transform incoming operations against all ops since the client's revision
3. Apply transformed ops to the document
4. Atomically update content + revision + ops list via Lua script (CAS on revision)
5. Return transformed ops for broadcasting to other clients

If a client's revision is too far behind, a full `code:sync` is sent instead.

---

## Configuration

### Environment Variables

| Variable                           | Default                         | Description                         |
| ---------------------------------- | ------------------------------- | ----------------------------------- |
| `CS_SERVER_PORT`                   | `3003`                          | HTTP/WS server port                 |
| `CS_FRONTEND_URL`                  | `http://localhost:5173`         | CORS origin                         |
| `CS_LOG_LEVEL`                     | `info`                          | Pino log level                      |
| `CS_SESSION_TTL_MS`                | `3600000` (1h)                  | TTL for all Redis keys              |
| `CS_DEPENDENCY_TIMEOUT_MS`         | `5000`                          | Timeout for external HTTP calls     |
| `CS_DISCONNECT_GRACE_MS`           | `30000` (30s)                   | Reconnection grace period           |
| `CS_HEARTBEAT_INTERVAL_MS`        | `25000`                         | Socket.IO ping interval             |
| `CS_HEARTBEAT_TIMEOUT_MS`         | `20000`                         | Socket.IO ping timeout              |
| `CS_SESSION_INACTIVITY_TIMEOUT_MS`| `1800000` (30min)               | Auto-end inactive sessions          |
| `CS_INACTIVITY_CHECK_INTERVAL_MS` | `60000` (1min)                  | Inactivity check polling interval   |
| `CS_API_GATEWAY_URL`               | `http://localhost:8080`         | API gateway base URL                |
| `CS_INTERNAL_SERVICE_API_KEY`      | `""`                            | Shared secret for internal auth     |
| `CS_USER_AUTH_CONTEXT_PATH`        | `/users/internal/authz/context` | Socket JWT validation path          |
| `CS_USER_AUTH_BATCH_PATH`          | `/users/internal/validation/batch` | User batch validation path       |
| `CS_QUESTION_SELECTION_PATH`       | `/internal/select`              | Question selection endpoint         |
| `CS_QUESTION_DETAILS_PATH`         | `/internal/get`                 | Question details endpoint           |
| `CS_USE_QUESTION_STUB`             | `false`                         | Use stub question for testing       |
| `CS_STUB_QUESTION_PREFIX`          | `"stub"`                        | Prefix for stub question IDs        |
| `CS_REDIS_HOST`                    | `127.0.0.1`                     | Redis host                          |
| `CS_REDIS_PORT`                    | `6379`                          | Redis port                          |
| `CS_REDIS_DB`                      | `0`                             | Redis database number               |
| `CS_REDIS_KEY_PREFIX`              | `collaboration-service:`        | Prefix for all Redis keys           |
| `CS_USER_SERVICE_URL`              | `http://user-service:3001`      | User service base URL               |
| `CS_QUESTIONS_SERVICE_URL`         | `http://questions-service:3005` | Question service base URL           |
| `CS_EXECUTION_SERVICE_URL`         | `http://execution-service:3006` | Execution service base URL          |
| `CS_ATTEMPT_SERVICE_URL`           | `http://attempts-service:3004`  | Attempt service base URL            |

---

## Data Models

### CollaborationSession

```typescript
type CollaborationSession = {
    collaborationId: string;
    matchId?: string;
    userAId: string;
    userBId: string;
    difficulty: "Easy" | "Medium" | "Hard";
    language: string;
    topic: string;
    questionId: string;
    status: "active" | "inactive";
    createdAt: string;
};
```

### OTOperation

```typescript
type OTOperation = {
    type: "insert" | "delete" | "retain";
    position: number;
    text?: string;
    count?: number;
};
```

### SessionParticipantPresence

```typescript
type SessionParticipantPresence = {
    userId: string;
    status: "connected" | "disconnected" | "left";
    connectionCount: number;
};
```

### TestCase (execution)

```typescript
type TestCase = {
    input: unknown;
    output: unknown;
};
```

### TestCaseResult (execution response)

```typescript
type TestCaseResult = {
    testCaseIndex: number;
    passed: boolean;
    actualOutput: string;
    expectedOutput: string;
    error?: string;
    executionTimeMs: number;
};
```

---

## Error Codes

| Code                            | Context   | Description                          |
| ------------------------------- | --------- | ------------------------------------ |
| `INVALID_SESSION_REQUEST`       | HTTP 400  | Invalid request payload              |
| `UNAUTHORIZED_INTERNAL_REQUEST` | HTTP 401  | Invalid internal service key         |
| `SOCKET_AUTHENTICATION_FAILED`  | Socket    | JWT validation failed                |
| `SESSION_ACCESS_DENIED`         | Socket    | User not assigned to this session    |
| `REJOIN_GRACE_PERIOD_EXPIRED`   | Socket    | Reconnection timeout exceeded (30s)  |
| `SESSION_NOT_FOUND`             | Both      | Session doesn't exist in Redis       |
| `SESSION_INACTIVE`              | Both      | Session has been ended               |
| `ACTIVE_SESSION_CONFLICT`       | HTTP 409  | Active session exists for user pair  |
| `SESSION_CAPACITY_REACHED`      | Socket    | Session already has 2 connected users|
| `INVALID_JOIN_REQUEST`          | Socket    | Missing collaborationId              |
| `USER_VALIDATION_FAILED`        | HTTP 424  | User validation failed               |
| `QUESTION_NOT_FOUND`            | HTTP 424  | No matching question                 |
| `USER_SERVICE_UNAVAILABLE`      | HTTP 503  | User Service unreachable             |
| `QUESTION_SERVICE_UNAVAILABLE`  | HTTP 503  | Question Service unreachable         |

---

## Files Reference

```
backend/services/collaborationService/
├── src/
│   ├── app.ts                              # Express app, CORS, routes, Socket.IO mount
│   ├── index.ts                            # Server startup, inactivity timer
│   ├── config/
│   │   ├── constants.ts                    # HTTP status, error codes, socket event names
│   │   └── env.ts                          # Environment variable parsing
│   ├── middleware/
│   │   ├── errorHandler.ts                 # Global error handling
│   │   ├── internalServiceAuth.ts          # x-internal-service-key validation
│   │   └── socketAuth.ts                   # Socket.IO JWT auth via User Service
│   ├── models/
│   │   └── session.ts                      # TypeScript types
│   ├── repositories/
│   │   ├── redisSessionRepository.ts       # Session metadata + question cache
│   │   ├── redisOTRepository.ts            # OT documents (Lua CAS script)
│   │   ├── redisPresenceRepository.ts      # Presence, sockets, activity, left users
│   │   ├── redisOutputRepository.ts        # Execution output cache
│   │   └── sessionCacheRepository.ts       # Session read cache
│   ├── routes/
│   │   └── sessionRoutes.ts                # POST /sessions handler
│   ├── services/
│   │   ├── collaborationSessionService.ts  # Core session logic
│   │   ├── codeExecutionService.ts         # HTTP client → Execution Service
│   │   ├── attemptRecordingService.ts      # HTTP client → Attempt Service
│   │   ├── otService.ts                    # OT algorithm + document manager
│   │   ├── userValidationService.ts        # HTTP client → User Service
│   │   ├── questionSelectionService.ts     # HTTP client → Question Service
│   │   └── validation.ts                   # Request payload validation
│   ├── sockets/
│   │   └── registerSocketHandlers.ts       # All socket event handlers
│   └── utils/
│       ├── redis.ts                        # Redis client singleton
│       └── logger.ts                       # Pino logger
├── Dockerfile
├── package.json
├── tsconfig.json
├── .env.example
└── COLLABORATION-SERVICE.md                # This file
```

---

## Docker / Infrastructure

### docker-compose.yml services

| Service                | Port | Description                          |
| ---------------------- | ---- | ------------------------------------ |
| `collaboration-service`| 3003 | This service                         |
| `collaboration-redis`  | —    | Redis instance (internal only)       |
| `execution-service`    | 3006 | Code execution adapter               |
| `piston`               | 2000 | Piston sandboxed code execution      |
| `attempts-service`     | 3004 | Attempt recording (PostgreSQL-backed) |
| `attempts-db`          | 5436 | PostgreSQL for attempts              |

### Collaboration service depends on:

- `collaboration-redis` — Redis for all state
- `user-service` — JWT auth + user validation
- `questions-service` — question selection + details

### Runtime dependencies (called via HTTP):

- `execution-service` — code execution (calls Piston internally)
- `attempts-service` — recording attempts for both users

### Piston Setup

The Execution Service installs required Piston runtimes on startup (fire-and-forget). Runtimes are persisted in a Docker volume (`piston_data`). On Apple Silicon, Piston runs under Rosetta (x86 emulation) so initial runtime installs may be slow.
