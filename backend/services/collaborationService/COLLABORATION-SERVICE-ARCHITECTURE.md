# Collaboration Service Architecture and Design Notes

## Purpose

The Collaboration Service is responsible for turning a successful match into a live shared coding room where exactly two matched users can:

- join the same session
- receive the same question prompt
- edit the same code buffer concurrently
- run and submit code
- survive disconnects and reconnects without losing server state

This document is written for mentor walkthroughs. It explains the current implementation, the architectural decisions behind it, and the trade-offs.

---

## 1. Real-Time Technology Selection

### Chosen technology

We use:

- `Socket.IO` for real-time bidirectional communication
- `Redis` for shared session state, presence, OT document state, and cross-request durability


### Why Socket.IO is appropriate

Socket.IO is a good fit here because the collaboration room is not just raw message streaming. We need:

- authenticated socket connections
- room-based broadcasting
- event acknowledgements
- heartbeat-based disconnect detection
- automatic reconnection support
- browser-friendly fallback/recovery behavior

Compared with plain WebSocket, Socket.IO gives us these collaboration primitives out of the box and reduces custom protocol code.

### Why Redis is appropriate

Redis is a good fit because collaboration state is:

- short-lived
- highly mutable
- latency-sensitive
- naturally key-value or set based

We do not need relational queries during a live session. Redis lets us keep:

- session metadata
- live code document
- code revision
- recent OT history
- presence and socket bindings
- output cache

all with TTLs and atomic updates.

### Why this combination works well

Socket.IO handles transport and fan-out. Redis holds the authoritative state. That separation gives us:

- fast real-time messaging
- recovery after reconnect
- clean service boundaries
- a path to horizontal scaling because state is not trapped in process memory

---

## 2. High-Level Architecture

### Main responsibilities

- Matching Service triggers the creation of the collaboration session after a match is found.
- Collaboration Service owns room lifecycle and real-time editing.
- Question Service selects and returns the problem.
- Execution Service runs the code against test cases.
- Attempt Service stores the final submission record and updates user scores via the User Service.

---

## 3. Service Integration Workflow

### Matching to Collaboration handoff

Current flow:

1. User joins matchmaking over sockets.
2. Matching Service finds a partner using Redis and Lua matchmaking logic.
3. Matching Service generates a `matchId`.
4. Matching Service calls `POST /sessions` on Collaboration Service with:
   - `matchId`
   - `userAId`
   - `userBId`
   - `difficulty`
   - `language`
   - `topic`
5. Collaboration Service validates users, selects a question, creates Redis-backed session state, and returns `collaborationId`.
6. Matching Service emits `match_success` to the frontend with `collaborationId`.
7. Frontend routes both users to `/collaboration/:collaborationId`.
8. Frontend opens a collaboration socket and emits `session:join`.
9. Collaboration Service returns the authoritative initial room state, including the question and current code snapshot.

### Why this handoff is good

- Matching stays focused on pairing logic.
- Collaboration owns session lifecycle after a match exists.
- The frontend receives a single room identifier, `collaborationId`, which becomes the stable handle for all room operations.
- If matching retries or reconnects, idempotent session creation reduces duplication risk.

---

## 4. Question Handoff Workflow

Question propagation happens in two stages:

### Stage A: question selection during session creation

When `POST /sessions` is called, Collaboration Service calls Question Service to select one question matching:

- topic
- difficulty
- matched users

The chosen `questionId` is persisted in the collaboration session.

### Stage B: question details during first join

When a user joins the room:

1. Collaboration Service fetches full question details from Question Service.
2. The question is returned in the `session:join` acknowledgement.
3. The question title, test cases, and function name are cached in Redis for later `run` and `submit`.

### Why this split is useful

- Session creation stays lightweight and stores only the minimum identity of the question.
- Full question details are fetched only when the room is actually entered.
- Execution no longer depends on repeated question-service lookups for every run.

---

## 5. Current API Endpoints

### Public/internal HTTP endpoints

#### `GET /health`

Purpose:

- health check for service liveness

Response:

```json
{
  "status": "ok",
  "service": "collaboration-service"
}
```

#### `POST /sessions`

Auth:

- internal service only via `x-internal-service-key`

Purpose:

- create or reuse a collaboration session after a successful match

Request body:

```json
{
  "matchId": "uuid",
  "userAId": "uuid",
  "userBId": "uuid",
  "difficulty": "Easy | Medium | Hard",
  "language": "typescript",
  "topic": "arrays"
}
```

Success response:

```json
{
  "session": {
    "collaborationId": "uuid",
    "matchId": "uuid",
    "userAId": "uuid",
    "userBId": "uuid",
    "difficulty": "Medium",
    "language": "typescript",
    "topic": "arrays",
    "questionId": "uuid",
    "status": "active",
    "createdAt": "2026-03-31T00:00:00.000Z"
  },
  "idempotentHit": false,
  "cacheWriteSucceeded": true
}
```

Conflict behavior:

- if the same user pair already has an active session, the service returns a conflict with the existing `collaborationId`
- Matching Service currently treats this as a safe reuse case

---

## 6. Socket Events

Socket path:

- frontend connects through gateway path: `/cs/sessions`
- service-side Socket.IO path: `/sessions/socket.io/`

### Connection/auth events

#### `connection:ready`

Server to client after socket authentication succeeds.

Payload:

```json
{
  "userId": "uuid"
}
```

### Session events

#### `session:join`

Client to server:

```json
{
  "collaborationId": "uuid"
}
```

Ack on success:

```json
{
  "ok": true,
  "state": {
    "session": { "...": "..." },
    "questionId": "uuid",
    "question": {
      "quid": "uuid",
      "title": "Two Sum",
      "description": "...",
      "difficulty": "Easy",
      "topics": ["arrays", "hashmap"],
      "testCase": [{ "input": [1,2], "output": 3 }],
      "functionName": "twoSum"
    },
    "codeSnapshot": "",
    "codeRevision": 0,
    "participants": [
      { "userId": "uuid", "status": "connected", "connectionCount": 1 }
    ],
    "isFirstConnection": true,
    "wasDisconnected": false,
    "disconnectDurationMs": 0
  }
}
```

Ack on failure:

```json
{
  "ok": false,
  "error": "SESSION_ACCESS_DENIED",
  "message": "..."
}
```

#### `session:check-active`

Client to server (used from matching view to detect rejoinable sessions):

```json
{}
```

Ack:

```json
{
  "ok": true,
  "activeSession": {
    "collaborationId": "uuid",
    "topic": "arrays",
    "difficulty": "Easy"
  }
}
```

Returns `null` for `activeSession` if the user has no active session or has intentionally left.

#### `session:leave`

Client to server:

```json
{
  "collaborationId": "uuid"
}
```

Ack:

```json
{
  "ok": true
}
```

#### `session:ended`

Server to room:

```json
{
  "collaborationId": "uuid",
  "reason": "both_users_left | inactivity_timeout"
}
```

### Presence events

#### `presence:updated`

Server to room:

```json
{
  "collaborationId": "uuid",
  "participants": [
    { "userId": "uuid", "status": "connected", "connectionCount": 1 },
    { "userId": "uuid", "status": "disconnected", "connectionCount": 0 }
  ]
}
```

#### `user:joined`

Server to other participant:

```json
{
  "collaborationId": "uuid",
  "userId": "uuid",
  "isFirstConnection": false,
  "wasDisconnected": true
}
```

#### `user:disconnected`

Server to room:

```json
{
  "collaborationId": "uuid",
  "userId": "uuid",
  "reason": "ping timeout"
}
```

#### `user:left`

Server to room:

```json
{
  "collaborationId": "uuid",
  "userId": "uuid"
}
```

### Code collaboration events

#### `code:change`

Client to server:

```json
{
  "collaborationId": "uuid",
  "revision": 5,
  "operations": [
    { "type": "insert", "position": 10, "text": "x" }
  ]
}
```

Ack:

```json
{
  "ok": true,
  "revision": 6
}
```

Server to other participant:

```json
{
  "collaborationId": "uuid",
  "userId": "uuid",
  "revision": 6,
  "operations": [
    { "type": "insert", "position": 10, "text": "x" }
  ]
}
```

#### `code:sync`

Server to out-of-sync client:

```json
{
  "collaborationId": "uuid",
  "code": "latest full buffer",
  "revision": 6
}
```

### Execution events

#### `code:run`

Client to server:

```json
{
  "collaborationId": "uuid"
}
```

#### `code:submit`

Client to server:

```json
{
  "collaborationId": "uuid"
}
```

#### `code:running`

Server to room:

```json
{
  "collaborationId": "uuid"
}
```

#### `output:updated`

Server to room:

```json
{
  "collaborationId": "uuid",
  "output": {
    "results": [],
    "totalTestCases": 0,
    "testCasesPassed": 0,
    "stderr": ""
  }
}
```

#### `submission:complete`

Server to submitter:

```json
{
  "collaborationId": "uuid",
  "success": true,
  "totalTestCases": 8,
  "testCasesPassed": 8
}
```

---

## 7. Data Schema

### Session schema

```ts
type CollaborationSession = {
  collaborationId: UUID;
  matchId?: UUID;
  userAId: UUID;
  userBId: UUID;
  difficulty: "Easy" | "Medium" | "Hard";
  language: string;
  topic: string;
  questionId: UUID;
  status: "active" | "inactive";
  createdAt: string;
};
```

### Presence schema

```ts
type SessionParticipantPresence = {
  userId: UUID;
  status: "connected" | "disconnected" | "left";
  connectionCount: number;
};
```

### OT operation schema

```ts
type OTOperation =
  | { type: "insert"; position: number; text: string }
  | { type: "delete"; position: number; count: number }
  | { type: "retain"; position: number };
```

### Execution output schema

```ts
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

---

## 8. Redis Key Design

The collaboration service stores all live room state in Redis with TTLs.

### Session keys

- `session:{collaborationId}`
  - Redis hash
  - stores session metadata

- `session:pair:{sortedUserA}:{sortedUserB}`
  - Redis string
  - ensures only one active session per matched pair

- `session:idempotency:{matchOrPair}:{difficulty}:{language}:{topic}`
  - Redis string
  - prevents duplicate session creation on retried internal requests

- `user:active-session:{userId}`
  - Redis string
  - maps a user to their current active `collaborationId` for O(1) lookup
  - set for both users when a session is created
  - cleared when a user intentionally leaves or when the session ends
  - used by `session:check-active` to power the rejoin banner on the matching view

### Presence keys

- `presence:{collaborationId}:{userId}`
  - Redis hash
  - fields include `status`, `socketCount`, `lastActivityTime`, `lastDisconnectTime`

- `presence:{collaborationId}:sockets`
  - Redis set
  - contains all active socket IDs in the room

- `socket:{socketId}`
  - Redis hash
  - reverse lookup from socket to `collaborationId` and `userId`

- `left:{collaborationId}`
  - Redis set
  - tracks users who intentionally left

- `activity:{collaborationId}`
  - Redis string
  - stores last room activity timestamp for inactivity termination

### OT keys

- `ot:{collaborationId}:content`
  - Redis string
  - authoritative text buffer

- `ot:{collaborationId}:revision`
  - Redis string/integer
  - authoritative revision number

- `ot:{collaborationId}:ops`
  - Redis list
  - recent OT operation history, capped to 50 entries

### Output keys

- `output:{collaborationId}`
  - Redis string
  - last execution result payload

### Optional cache key

- `collab:session:{collaborationId}`
  - Redis hash
  - additional cached copy of session metadata

### Why this Redis design is good

- hashes group related metadata
- sets are natural for socket and left-user membership
- strings are enough for content and revision
- lists are ideal for recent OT history
- TTLs automatically clean abandoned rooms over time

---

## 9. Conflict Resolution Mechanism

### Chosen algorithm

We use `Operational Transformation (OT)` with:

- a server-authoritative document
- integer revision numbers
- transformation of client operations against unseen remote operations
- atomic compare-and-swap persistence in Redis using a Lua script

### How concurrent edits are handled

When a client sends `code:change`, it includes:

- the client’s last known `revision`
- a list of text operations

Server flow:

1. Read current document and revision from Redis.
2. If client revision is behind server revision, fetch all server operations since that revision.
3. Transform the incoming operations against those unseen operations.
4. Apply the transformed operations to the server document.
5. Attempt atomic update only if the stored revision still matches.
6. If the revision changed meanwhile, retry with fresh state.
7. On success, return the new revision to the sender and broadcast transformed operations to the other user.

### Why this prevents data loss

- no client directly overwrites the full document
- edits are represented as intent-preserving operations
- transformation rebases concurrent edits instead of dropping one side
- Redis compare-and-swap prevents race-condition writes from silently winning
- if reconciliation fails, the client receives `code:sync` with authoritative full state

### Why compare-and-swap is necessary

The CAS exists because two users can send `code:change` at nearly the same time. Without it, one user's edit could silently overwrite the other's.

Here's the problem it solves:

1. Server document is at revision 5
2. User A sends an edit based on revision 5
3. User B sends an edit based on revision 5 at the same time
4. Both get transformed and try to write revision 6

Without CAS, whoever's write hits Redis last wins, and the other edit is lost. With the Lua CAS script, the flow is:

- Read the current revision (5)
- Transform the operations
- **Atomically:** check the revision is still 5, then write the new content + revision 6 + push to ops list — all in one Lua script that Redis executes without interleaving
- If the revision changed between the read and the write (because the other user's edit landed first), the Lua script returns 0 (conflict) and the server retries with the new state

The "compare" is checking the revision hasn't changed. The "swap" is writing the new content + revision. Because Lua scripts in Redis are atomic (no other command can run in between), this guarantees exactly one writer wins per revision, and the loser retries with full knowledge of what changed. This is what prevents data loss during concurrent edits.

### Why OT instead of CRDT

OT was chosen because this is a 2-user plain-text code editor and OT is a strong fit for:

- centralized server authority
- low-latency text editing
- compact operations
- simpler storage than tombstone-heavy CRDTs

CRDTs are better for offline-first and peer-heavy systems, but for this project they would add:
- more metadata overhead
- more implementation complexity
- less need for server arbitration benefits we already want

### Technical justification summary
For a centralized collaborative code editor with only two active peers, OT gives a better complexity-to-value trade-off than CRDT.

---

## 10. Sequence Diagrams

### 10.1 Session creation (`POST /sessions`)

```text
Matching Service        Collaboration Service        User Service        Question Service
     │                          │                         │                      │
     │  POST /sessions          │                         │                      │
     │────────────────────────▶ │                         │                      │
     │                          │  validate users         │                      │
     │                          │────────────────────────▶│                      │
     │                          │  both "active"          │                      │
     │                          │◀────────────────────────│                      │
     │                          │                         │                      │
     │                          │  select question        │                      │
     │                          │───────────────────────────────────────────────▶│
     │                          │  { questionId }         │                      │
     │                          │◀────────────────────────────────────────────── │
     │                          │                         │                      │
     │                          │  idempotency check      │                      │
     │                          │  create session in Redis│                      │
     │                          │  init OT document       │                      │
     │                          │  write cache            │                      │
     │                          │                         │                      │
     │  201 { session,          │                         │                      │
     │    collaborationId }     │                         │                      │
     │◀──────────────────────── │                         │                      │
```

**Endpoint:** `POST /sessions` authenticated via `x-internal-service-key` header.

**Request body:** `{ matchId, userAId, userBId, difficulty, language, topic }`

**External service calls:**

1. `POST {userServiceUrl}/users/internal/validation/batch` with `{ userIds: [userAId, userBId] }` — verifies both users are "active"
2. `POST {questionsServiceUrl}/internal/select` with `{ topic, difficulty, userAId, userBId }` — selects a question

**Redis idempotency check:**

- `GET session:idempotency:{matchId}:{difficulty}:{language}:{topic}` — if exists, returns the existing session (idempotent hit)
- `GET session:pair:{sortedUserA}:{sortedUserB}` — if an active session exists for this pair, returns 409 conflict

**Redis writes on new session (pipeline):**

- `HSET session:{collaborationId}` — session metadata hash (all fields including `collaborationId`, `matchId`, `userAId`, `userBId`, `difficulty`, `language`, `topic`, `questionId`, `status`, `createdAt`)
- `PEXPIRE session:{collaborationId} 3600000`
- `SET session:pair:{sortedUserA}:{sortedUserB} {collaborationId} PX 3600000` — pair uniqueness guard
- `SET session:idempotency:{key} {collaborationId} PX 3600000` — idempotency guard

**User-to-session index (pipeline, set for both users):**

- `SET user:active-session:{userAId} {collaborationId} PX 3600000`
- `SET user:active-session:{userBId} {collaborationId} PX 3600000`

**OT document initialization (pipeline):**

- `SET ot:{collaborationId}:content {initialCode} PX 3600000` — pre-populated with a `class Solution` template based on the session language and the question's `functionName`, or empty if question details are unavailable
- `SET ot:{collaborationId}:revision "0" PX 3600000` — revision starts at 0

**Cache write (separate Redis instance, non-fatal):**

- `MULTI` → `HSET collab:session:{collaborationId}` → `PEXPIRE collab:session:{collaborationId} 3600000` → `EXEC`

---

### 10.2 Full join flow (`session:join`)

```text
Frontend (User A)        Collaboration Service        Question Service
     │                          │                           │
     │  Socket.IO connect       │                           │
     │  (auth: { token })       │                           │
     │────────────────────────▶ │                           │
     │                          │  authenticate socket      │
     │  ◀── connection:ready ── │                           │
     │                          │                           │
     │  emit session:join       │                           │
     │  { collaborationId }     │                           │
     │────────────────────────▶ │                           │
     │                          │  validate session         │
     │                          │  check grace period       │
     │                          │  register socket          │
     │                          │  read OT state            │
     │                          │                           │
     │                          │  fetch question details   │
     │                          │─────────────────────────▶ │
     │                          │  { title, testCase, ... } │
     │                          │◀───────────────────────── │
     │                          │                           │
     │                          │  cache question in Redis  │
     │                          │  get participants         │
     │                          │  socket.join(room)        │
     │                          │                           │
     │  ack { ok, state }       │                           │
     │◀──────────────────────── │                           │
     │                          │                           │
     │                          │── user:joined ──────────▶ User B (room)
     │                          │── presence:updated ─────▶ Both users (room)
```

**Socket path:** frontend connects through gateway at `/cs/sessions`, Socket.IO server path is `/sessions/socket.io/`.

**Socket authentication middleware:**

- Reads token from `Authorization` header or `socket.handshake.auth.token`
- Calls `GET {userServiceUrl}/users/internal/authz/context` with the token
- Verifies `status === "active"` and stores `socket.data.userId = clerkUserId`
- On success, emits `connection:ready` with `{ userId }` to the connecting socket

**Session validation (Redis reads):**

- `HGETALL session:{collaborationId}` — checks session exists and `status === "active"`
- Checks `userId` is one of `session.userAId` or `session.userBId` — rejects with `SESSION_ACCESS_DENIED` if not
- `SISMEMBER left:{collaborationId} {userId}` — rejects if user already left (must be 0)

**Grace period check (for reconnecting users):**

- `HGETALL presence:{collaborationId}:{userId}` — reads current presence state
- If `status === "disconnected"`: computes `(now - lastDisconnectTime)`, rejects with `REJOIN_GRACE_PERIOD_EXPIRED` if it exceeds `CS_DISCONNECT_GRACE_MS` (30000ms)
- If `status === "left"`: rejects (cannot rejoin after leaving)

**Socket registration (Redis pipeline):**

- `HSET presence:{collaborationId}:{userId} { userId, status: "connected", socketCount: +1, lastActivityTime: now }`
- `HDEL presence:{collaborationId}:{userId} lastDisconnectTime`
- `PEXPIRE presence:{collaborationId}:{userId} 3600000`
- `SADD presence:{collaborationId}:sockets {socketId}`
- `PEXPIRE presence:{collaborationId}:sockets 3600000`
- `HSET socket:{socketId} { collaborationId, userId }`
- `PEXPIRE socket:{socketId} 3600000`
- `SREM left:{collaborationId} {userId}`
- `SET activity:{collaborationId} {now} PX 3600000`

This pipeline returns `{ isFirstConnection, wasDisconnected, disconnectDurationMs }`.

**OT state read:**

- `GET ot:{collaborationId}:content` — current code buffer (returned as `codeSnapshot`)
- `GET ot:{collaborationId}:revision` — current revision number (returned as `codeRevision`)

**Question fetch:**

- `POST {questionsServiceUrl}/internal/get` with `{ questionId }`
- On first join: caches question metadata via `HSET session:{collaborationId} { questionTitle, testCases, functionName }` for later use by `code:run` and `code:submit`

**Participant list:**

- `HGETALL presence:{collaborationId}:{userAId}` and `HGETALL presence:{collaborationId}:{userBId}`
- Builds `[{ userId, status, connectionCount }]`

**Socket room:** `socket.join("collaboration:{collaborationId}")`

**Ack payload:** `{ ok: true, state: { session, questionId, question, codeSnapshot, codeRevision, participants, isFirstConnection, wasDisconnected, disconnectDurationMs } }`

**Emitted events:**

- `user:joined` to room (excluding sender) via `socket.to()`: `{ collaborationId, userId, isFirstConnection, wasDisconnected }`
- `presence:updated` to entire room via `io.to()`: `{ collaborationId, participants }`

---

### 10.3 Concurrent editing (`code:change`)

```text
User A Client           Collaboration Service            User B Client
    │                          │                               │
    │  emit code:change        │                               │
    │  { collaborationId,      │                               │
    │    revision, operations }│                               │
    │────────────────────────▶ │                               │
    │                          │  validate session + user      │
    │                          │  OT transform + Lua CAS       │
    │                          │  update activity timestamp    │
    │                          │                               │
    │  ack { ok, revision }    │                               │
    │◀──────────────────────── │                               │
    │                          │                               │
    │                          │── code:change ──────────────▶ │
    │                          │   { userId, revision,         │
    │                          │     operations }              │
```

**Validation (Redis reads):**

- `HGETALL session:{collaborationId}` — checks session is active and user is assigned
- `SISMEMBER left:{collaborationId} {userId}` — checks user hasn't left

**OT transformation (retry loop, max 5 attempts):**

Each attempt:

1. `GET ot:{collaborationId}:content` — current document
2. `GET ot:{collaborationId}:revision` — current server revision
3. If `clientRevision < serverRevision`: fetch history via `LRANGE ot:{collaborationId}:ops 0 -1`, filter for ops since `clientRevision`, sort ascending by revision. Transform incoming client operations against each unseen server operation from a different user.
4. If `clientRevision > serverRevision`: reject (client ahead, invalid state).
5. Apply transformed operations to the document content.
6. **Atomic CAS via Lua script** with keys `[ot:{id}:content, ot:{id}:revision, ot:{id}:ops]`:
   - `GET ot:{id}:revision` — compare with expected revision
   - If match: `SET ot:{id}:content {newContent}`, `SET ot:{id}:revision {newRevision}`, `LPUSH ot:{id}:ops {operationJson}`, `LTRIM ot:{id}:ops 0 49`, `PEXPIRE ot:{id}:ops {ttl}`
   - Returns 1 (success) or 0 (conflict — another write landed between read and CAS)
7. If CAS returns 0: retry from step 1 with fresh state.

**After successful CAS:**

- `SET activity:{collaborationId} {now} PX {ttl}` — update activity timestamp
- Ack to sender: `{ ok: true, revision: newRevision }`
- Broadcast to room (excluding sender) via `socket.to()`: `code:change` with `{ collaborationId, userId, revision: newRevision, operations: transformedOps }`

**After 5 CAS failures (sync fallback):**

- Reads full authoritative state: `HGETALL session:{id}`, `GET ot:{id}:content`, `GET ot:{id}:revision`, `GET output:{id}`
- Emits `code:sync` to the requesting socket only: `{ collaborationId, code: fullBuffer, revision: currentRevision }`
- Ack with `{ ok: false, error: "..." }`

---

### 10.4 Code execution (`code:run`)

```text
User A Client           Collaboration Service           Execution Service
    │                          │                               │
    │  emit code:run           │                               │
    │  { collaborationId }     │                               │
    │────────────────────────▶ │                               │
    │                          │── code:running ─────────────▶ Both users (room)
    │                          │                               │
    │                          │  read code + question from Redis
    │                          │                               │
    │                          │  POST /execute                │
    │                          │─────────────────────────────▶ │
    │                          │  { results, stderr, ... }     │
    │                          │◀───────────────────────────── │
    │                          │                               │
    │                          │  cache output in Redis        │
    │                          │── output:updated ───────────▶ Both users (room)
    │                          │                               │
    │  ack { ok: true }        │                               │
    │◀──────────────────────── │                               │
```

**Immediate broadcast:** `io.to(room).emit("code:running", { collaborationId })` — notifies both users execution has started.

**Redis reads for execution data:**

- `HGETALL session:{collaborationId}` — session metadata (language, etc.)
- `GET ot:{collaborationId}:content` — current code buffer
- `HMGET session:{collaborationId} questionTitle testCases functionName` — cached question details (set during first `session:join`)

**External service call:** `POST {executionServiceUrl}/execute` with `{ code, language, functionName, testCases }` and a 60-second timeout.

**Redis write:** `SET output:{collaborationId} {JSON.stringify(result)} PX {ttl}` — caches execution output.

**Broadcast results:** `io.to(room).emit("output:updated", { collaborationId, output: result })` — sent to both users.

**On error:** broadcasts `output:updated` with `{ error: message }` to entire room, acks with `{ ok: false }`.

---

### 10.5 Code submission (`code:submit`)

```text
User A Client           Collaboration Service        Execution Svc      Attempt Service
    │                          │                          │                    │
    │  emit code:submit        │                          │                    │
    │  { collaborationId }     │                          │                    │
    │────────────────────────▶ │                          │                    │
    │                          │── code:running ────────▶ Both users           │
    │                          │                          │                    │
    │                          │  [same as code:run]      │                    │
    │                          │──── POST /execute ─────▶ │                    │
    │                          │◀── { results } ───────── │                    │
    │                          │                          │                    │
    │                          │  cache output, broadcast output:updated       │
    │                          │                          │                    │
    │                          │  POST /attempts          │                    │
    │                          │───────────────────────────────────────────▶   │
    │                          │◀──────────────────────────────────────────    │
    │                          │                          │                    │
    │  ◀── submission:complete │                          │                    │
    │  ◀── ack { ok: true }    │                          │                    │
```

The execution flow (broadcast `code:running`, read code + question from Redis, call Execution Service, cache output, broadcast `output:updated`) is identical to `code:run`.

**Additional step — record attempt:**

- `POST {attemptServiceUrl}/attempts` with `{ userId, collaborationId, questionId, questionTitle, language, difficulty, success, duration, totalTestCases, testCasesPassed }`
- `success` = `testCasesPassed === totalTestCases && totalTestCases > 0`
- `duration` = `(Date.now() - session.createdAt) / 1000` in seconds
- Recorded only for the **submitting user**, not both users

**Submitter-only event:** `socket.emit("submission:complete", { collaborationId, success, totalTestCases, testCasesPassed })` — sent only to the socket that submitted, not broadcast to the room.

**On attempt recording failure:** ack with `{ ok: false, error: "Code executed but failed to record attempt." }`.

---

### 10.6 Disconnect flow

```text
User A Client           Collaboration Service            User B Client
    │                          │                               │
    │  (socket lost)           │                               │
    │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─▶   │                               │
    │                          │  remove socket from Redis     │
    │                          │  update presence state        │
    │                          │                               │
    │                          │  (if last socket for user:)   │
    │                          │── user:disconnected ────────▶ │
    │                          │── presence:updated ──────────▶│
```

**Trigger:** Socket.IO fires `disconnect` event with a reason string (e.g., `"transport close"`, `"ping timeout"`).

**Redis reads:**

- `HGETALL socket:{socketId}` — reverse lookup to get `{ collaborationId, userId }`. Returns null if socket not bound (no-op).
- `HGETALL presence:{collaborationId}:{userId}` — get current `socketCount`

**Redis writes (pipeline):**

- `HSET presence:{collaborationId}:{userId} socketCount {max(0, socketCount - 1)}`
- If `newSocketCount === 0` (last socket for this user):
  - `HSET presence:{collaborationId}:{userId} { status: "disconnected", lastDisconnectTime: now }`
- `SREM presence:{collaborationId}:sockets {socketId}`
- `DEL socket:{socketId}`

**Socket events (only if last socket for user):**

- `io.to(room).emit("user:disconnected", { collaborationId, userId, reason })` — sent to entire room
- `io.to(room).emit("presence:updated", { collaborationId, participants })` — sent to entire room

**Important:** No explicit timer is set on disconnect. The grace period (`CS_DISCONNECT_GRACE_MS = 30000ms`) is enforced only when the user attempts to rejoin via `session:join`. The user's presence stays as `"disconnected"` indefinitely until they rejoin, the session TTL expires, or the inactivity timeout triggers.

---

### 10.7 Reconnect within grace period

```text
User A Client           Collaboration Service            User B Client
    │                          │                               │
    │  (reconnect < 30s)       │                               │
    │  Socket.IO connect       │                               │
    │────────────────────────▶ │                               │
    │  ◀── connection:ready ── │                               │
    │                          │                               │
    │  emit session:join       │                               │
    │────────────────────────▶ │                               │
    │                          │  grace period check: pass     │
    │                          │  register socket, read OT     │
    │                          │                               │
    │ ack { ok, state: {       │                               │
    │   wasDisconnected: true, │                               │
    │   disconnectDurationMs }}│                               │
    │◀──────────────────────── │                               │
    │                          │                               │
    │                          │── user:joined ──────────────▶ │
    │                          │── presence:updated ──────────▶ Both
```

The flow is the same as a normal `session:join` (section 10.2), with these differences:

- **Grace period check passes:** `HGETALL presence:{collaborationId}:{userId}` returns `status: "disconnected"` and `lastDisconnectTime: T`. The server computes `(now - T)` and verifies it is less than `CS_DISCONNECT_GRACE_MS` (30000ms).
- **Ack includes reconnect metadata:** `wasDisconnected: true`, `disconnectDurationMs` (e.g., 12000), `isFirstConnection: false`
- **`user:joined` includes reconnect context:** `{ collaborationId, userId, isFirstConnection: false, wasDisconnected: true }`

---

### 10.8 Reconnect after grace period expired

```text
User A Client           Collaboration Service
    │                          │
    │  (reconnect > 30s)       │
    │  emit session:join       │
    │────────────────────────▶ │
    │                          │  grace period check: fail
    │                          │
    │  ack { ok: false,        │
    │    error:                │
    │    "REJOIN_GRACE_PERIOD_ │
    │     EXPIRED" }           │
    │◀──────────────────────── │
```

- `HGETALL presence:{collaborationId}:{userId}` returns `status: "disconnected"`, `lastDisconnectTime: T`
- `(now - T)` exceeds `CS_DISCONNECT_GRACE_MS` (30000ms)
- Ack with `{ ok: false, error: "REJOIN_GRACE_PERIOD_EXPIRED" }`
- Socket is not added to the room, no presence or socket keys are written

---

### 10.9 Active session check (`session:check-active`)

```text
Frontend (Matching View)     Collaboration Service
     │                              │
     │  Socket.IO connect           │
     │  (dedicated socket,          │
     │   auth: { token })           │
     │────────────────────────────▶ │
     │                              │
     │  emit session:check-active   │
     │  {}                          │
     │────────────────────────────▶ │
     │                              │  GET user:active-session:{userId}
     │                              │  → collaborationId (or null)
     │                              │
     │                              │  if found:
     │                              │    HGETALL session:{collaborationId}
     │                              │    verify status === "active"
     │                              │    SISMEMBER left:{collaborationId} {userId}
     │                              │    verify user has NOT left
     │                              │
     │  ack { ok, activeSession:    │
     │    { collaborationId,        │
     │      topic, difficulty } }   │
     │◀──────────────────────────── │
     │                              │
     │  disconnect dedicated socket │
     │────────────────────────────▶ │
```

**Purpose:** When a user navigates to the matching view, the frontend checks whether they have an active session they can rejoin (e.g., after closing a tab without pressing Leave). If an active session is found, the matching view displays a rejoin banner with the session topic and difficulty.

**Frontend implementation detail:** The check uses a dedicated socket that is created and destroyed independently from the shared collaboration socket singleton. This prevents a race condition where the check socket's disconnect could interfere with the collaboration socket if Clerk causes a React re-render mid-check.

**Redis reads:**

- `GET user:active-session:{userId}` — O(1) lookup of active collaboration ID
- If found: `HGETALL session:{collaborationId}` — verify session exists and is `"active"`
- If session is valid: `SISMEMBER left:{collaborationId} {userId}` — verify user has not intentionally left (returns 0)

**Returns `null` when:**

- No `user:active-session:{userId}` key exists
- Session status is not `"active"` (cleans up stale index key)
- User is in the `left:{collaborationId}` set (intentionally left)

---

## 11. Session Termination Scenarios

### A. Intentional leave (`session:leave`)

```text
User A Client           Collaboration Service            User B Client
    │                          │                               │
    │  emit session:leave      │                               │
    │  { collaborationId }     │                               │
    │────────────────────────▶ │                               │
    │                          │  mark user as left            │
    │                          │  remove all user sockets      │
    │                          │  check if both users left     │
    │                          │  socket.leave(room)           │
    │                          │                               │
    │                          │── user:left ───────────────▶  │
    │                          │── presence:updated ─────────▶ │
    │                          │                               │
    │  ack { ok: true }        │                               │
    │◀──────────────────────── │                               │
```

**Mark user as left (Redis pipeline):**

- `HSET presence:{collaborationId}:{userId} status "left"`
- `SADD left:{collaborationId} {userId}`
- `PEXPIRE left:{collaborationId} 3600000`

**Clear user-active-session index:**

- `DEL user:active-session:{userId}` — prevents stale rejoin prompts on the matching view

**Remove all user sockets:**

- `SMEMBERS presence:{collaborationId}:sockets` — get all socket IDs in the room
- Filter for sockets belonging to this user (via `HGETALL socket:{socketId}`)
- For each matching socket:
  - `SREM presence:{collaborationId}:sockets {socketId}`
  - `DEL socket:{socketId}`
- `HSET presence:{collaborationId}:{userId} { socketCount: "0", status: "left", lastDisconnectTime: now }`

**Check if session should end:**

- `SISMEMBER left:{collaborationId} {userAId}` and `SISMEMBER left:{collaborationId} {userBId}`
- If both left: triggers `endSession` (see scenario D)
- If only this user left: checks the other user's presence status
  - If the other user is `"disconnected"` (not coming back): also triggers `endSession`
  - If the other user is `"connected"`: session stays active, other user continues

**Socket events:**

- `socket.leave("collaboration:{collaborationId}")` — remove from Socket.IO room
- `io.to(room).emit("user:left", { collaborationId, userId })`
- `io.to(room).emit("presence:updated", { collaborationId, participants })`

---

### B. Unexpected disconnect

**Trigger:** socket disconnect (transport close, ping timeout, heartbeat timeout).

This follows the same flow as section 10.6.

- `presence:{collaborationId}:{userId}` is set to `status: "disconnected"` with `lastDisconnectTime`
- `socket:{socketId}` is deleted, socket is removed from `presence:{collaborationId}:sockets`
- Session stays active, no timer is set
- Grace period (`CS_DISCONNECT_GRACE_MS = 30000ms`) is enforced only when the user attempts to rejoin
- Remaining user receives `user:disconnected` and `presence:updated`

---

### C. Rejoin grace expiry

This follows the same flow as section 10.8.

- When a disconnected user emits `session:join` after the grace window:
  - Server reads `HGETALL presence:{collaborationId}:{userId}`
  - Compares `(now - lastDisconnectTime)` against `CS_DISCONNECT_GRACE_MS` (30000ms)
  - If expired: ack with `{ ok: false, error: "REJOIN_GRACE_PERIOD_EXPIRED" }`
  - Socket is not added to the room

---

### D. Both users leave (full session termination)

```text
User B Client           Collaboration Service
    │                          │
    │  emit session:leave      │  (User A already left)
    │────────────────────────▶ │
    │                          │  mark B as left
    │                          │  both users in left set
    │                          │  → trigger endSession
    │                          │  → full Redis cleanup
    │                          │
    │                          │── user:left ──────────▶ room
    │                          │── session:ended ──────▶ room
    │                          │   { reason:
    │                          │     "both_users_left" }
    │  ack { ok: true }        │
    │◀──────────────────────── │
```

**`endSession("both_users_left")` performs full cleanup:**

1. **Read final code state:** `GET ot:{collaborationId}:content`, `GET ot:{collaborationId}:revision`
2. **Mark session inactive:** `HSET session:{collaborationId} status "inactive"` then `DEL session:pair:{sortedUserA}:{sortedUserB}`
3. **Clear user-active-session index for both users:** `DEL user:active-session:{userAId}`, `DEL user:active-session:{userBId}`
4. **Delete session:** `DEL session:{collaborationId}`, `DEL session:pair:{sortedUserA}:{sortedUserB}`
5. **Cleanup presence** (using `assignedUserIds` passed directly, not derived from the sockets set which may already be empty after `leaveSession`):
   - `SMEMBERS presence:{collaborationId}:sockets` — get any remaining socket IDs
   - `DEL socket:{socketId}` for each socket
   - `DEL presence:{collaborationId}:sockets`
   - `DEL left:{collaborationId}`
   - `DEL activity:{collaborationId}`
   - `DEL presence:{collaborationId}:{userAId}`
   - `DEL presence:{collaborationId}:{userBId}`
6. **Delete OT document:** `DEL ot:{collaborationId}:content`, `DEL ot:{collaborationId}:revision`, `DEL ot:{collaborationId}:ops`
7. **Delete output:** `DEL output:{collaborationId}`

**Keys NOT deleted (expire via TTL):**

- `session:idempotency:{key}` — still prevents duplicate session creation until TTL expires
- `collab:session:{collaborationId}` — cache copy on separate Redis instance

**Socket events:**

- `io.to(room).emit("session:ended", { collaborationId, reason: "both_users_left" })`

---

### E. Inactivity timeout

```text
                        Collaboration Service
                               │
                               │  setInterval (every 60s)
                               │  scan for inactive sessions
                               │
                               │  for each inactive session:
                               │    endSession("inactivity_timeout")
                               │    full Redis cleanup
                               │
                               │── session:ended ────────────▶ room
                               │   { reason:
                               │     "inactivity_timeout" }
```

**Detection:** A `setInterval` runs every `CS_INACTIVITY_CHECK_INTERVAL_MS` (60000ms = 1 minute).

**Scanning for inactive sessions:**

- `SCAN 0 MATCH session:* COUNT 100` — cursor-based scan across all session keys
- Filters out `*:pair:*` and `*:idempotency:*` keys
- For each remaining key: `HGETALL` to get session, filters for `status === "active"`
- For each active session: `GET activity:{collaborationId}` to read last activity timestamp
- If `(now - lastActivity) > CS_SESSION_INACTIVITY_TIMEOUT_MS` (1800000ms = 30 minutes): marks session as inactive

**Cleanup:** calls `endSession("inactivity_timeout")` — same full cleanup as scenario D.

**Socket event:** `io.to("collaboration:{collaborationId}").emit("session:ended", { collaborationId, reason: "inactivity_timeout" })`

**Activity timestamp is updated by:**

- `session:join` — `SET activity:{collaborationId} {now} PX {ttl}` (when a user joins)
- `code:change` — `SET activity:{collaborationId} {now} PX {ttl}` (on every successful edit)

---

## 12. Execution Service

The Execution Service runs user-submitted code against test cases in a sandboxed environment. It is a standalone Express service that delegates all code execution to Piston.

### Technology

- **TypeScript / Node.js / Express** — lightweight HTTP service
- **Piston** — open-source code execution engine that runs each submission inside an isolated Linux namespace with cgroups

The service does not spawn child processes directly. It sends a single HTTP request to Piston's API for each execution.

### Supported languages

| Language | Piston runtime | Version |
|---|---|---|
| Python | `python` | `3.10.0` |
| JavaScript | `node` | `18.15.0` |
| TypeScript | `typescript` | `5.0.3` |
| Java | `java` | `15.0.2` |

At startup, the service polls Piston's `/api/v2/runtimes` and auto-installs any missing runtimes via `POST /api/v2/packages`.

### API

#### `GET /health`

No authentication. Returns `{ "status": "ok", "service": "execution-service" }`.

#### `POST /execute`

Authenticated via `x-internal-service-key` header.

Request body:

```json
{
  "code": "function twoSum(nums, target) { ... }",
  "language": "javascript",
  "functionName": "twoSum",
  "testCases": [
    { "input": [[2,7,11,15], 9], "output": [0,1] }
  ]
}
```

Response:

```json
{
  "results": [
    {
      "testCaseIndex": 0,
      "passed": true,
      "actualOutput": "[0,1]",
      "expectedOutput": "[0,1]",
      "executionTimeMs": 45
    }
  ],
  "totalTestCases": 1,
  "testCasesPassed": 1,
  "stderr": ""
}
```

On per-test-case failure, the result includes an `error` field (e.g., `"TypeError: cannot read property of undefined"`).

### How execution works

```text
Collaboration Service            Execution Service               Piston
      │                                │                            │
      │  POST /execute                 │                            │
      │  { code, language,             │                            │
      │    functionName, testCases }   │                            │
      │──────────────────────────────▶ │                            │
      │                                │  generate combined source  │
      │                                │  (user code + test harness)│
      │                                │                            │
      │                                │  POST /api/v2/execute      │
      │                                │  { language, files,        │
      │                                │    stdin, timeouts }       │
      │                                │──────────────────────────▶ │
      │                                │                            │
      │                                │  { stdout, stderr,         │
      │                                │    code, signal }          │
      │                                │◀────────────────────────── │
      │                                │                            │
      │                                │  parse stdout JSON         │
      │                                │  compare actual vs expected│
      │                                │                            │
      │  { results, totalTestCases,    │                            │
      │    testCasesPassed, stderr }   │                            │
      │◀────────────────────────────── │                            │
```

**Combined source generation:** For each language, the service appends a test harness to the user's code. The harness:

1. Reads stdin (which contains the JSON-serialized test cases array)
2. For each test case, calls the user's function with the input spread as arguments
3. Captures the return value or exception per test case
4. Prints a JSON array of `{ output, error }` to stdout

For Python/JS/TS, test case `input` is spread as positional arguments — `input: [1, 2]` calls `fn(1, 2)`. The harness supports two code patterns: a bare function definition (e.g., `def twoSum(...)`) and a `class Solution` pattern (e.g., `class Solution: def twoSum(self, ...)`). The harness resolves the function by first checking for a global function with the expected name, then falling back to instantiating a `Solution` class and calling the method on it. For Java, the harness always uses reflection to find the method by name on a `Solution` class.

**Output comparison:** Both actual and expected values are normalized to canonical JSON strings before comparison. Values that are already valid JSON strings are round-tripped through `JSON.parse` then `JSON.stringify`. Non-strings are `JSON.stringify`'d. Comparison is strict string equality.

### Resource limits and timeouts

| Setting | Default | Description |
|---|---|---|
| `PISTON_RUN_TIMEOUT` | 10000ms (10s) | Max execution time per run |
| `PISTON_RUN_MEMORY_LIMIT` | 134217728 (128 MB) | Max memory per run |
| Compile timeout | 15000ms (15s) | Max compilation time |
| Output max size | 65536 (64 KB) | Max stdout size |

The collaboration service also wraps the HTTP call in a 60-second `AbortController` timeout as a total deadline.

### Error categories

| Category | Detection | Result |
|---|---|---|
| Empty code | Code is blank/whitespace | All test cases failed, error: "No code provided" |
| Compilation error | Piston `compile.code !== 0` | All test cases failed, error includes compiler stderr |
| Timeout | Piston returns `signal: "SIGKILL"`, stderr has no "memory" mention | All test cases failed, error: "Time limit exceeded" |
| Out of memory | Piston returns `signal: "SIGKILL"`, stderr mentions "memory" | All test cases failed, error: "Memory limit exceeded" |
| Unparseable output | stdout is not valid JSON | All test cases failed, error: "Runtime error - could not parse output" |
| Per-test-case exception | Harness catches exception for one test case | That test case failed with the exception message |

### Security

- **Piston sandboxing:** each execution runs in an isolated Linux namespace with restricted syscalls, cgroups for resource limits
- **No networking:** `PISTON_DISABLE_NETWORKING=true` — user code cannot make outbound requests
- **Service authentication:** `x-internal-service-key` header required on all `/execute` requests
- **Request size limit:** `express.json({ limit: "1mb" })`

### Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3006` | HTTP server port |
| `INTERNAL_SERVICE_API_KEY` | — | Shared secret for service-to-service auth |
| `PISTON_URL` | `http://piston:2000` | Piston API base URL |
| `PISTON_RUN_TIMEOUT` | `10000` | Execution timeout in ms |
| `PISTON_RUN_MEMORY_LIMIT` | `134217728` | Memory limit in bytes |
| `LOG_LEVEL` | `info` | Pino log level |

---

## 13. Attempt Service Integration

### Purpose

After a user submits their code via `code:submit`, the collaboration service records the attempt in the attempt service. This persists the user's submission history and updates their score on the platform.

### When an attempt is recorded

An attempt is recorded **only** on `code:submit`, not on `code:run`. Only the **submitting user** gets an attempt recorded — the partner does not.

### Integration flow

```text
Collaboration Service              Attempt Service              User Service
       │                                 │                           │
       │  POST /attempts                 │                           │
       │  { userId, collaborationId,     │                           │
       │    questionId, questionTitle,    │                           │
       │    language, difficulty,         │                           │
       │    success, duration,            │                           │
       │    totalTestCases,               │                           │
       │    testCasesPassed }             │                           │
       │───────────────────────────────▶  │                           │
       │                                  │                           │
       │                                  │  check for existing       │
       │                                  │  attempt with same        │
       │                                  │  (userId, collaborationId)│
       │                                  │                           │
       │                                  │  if exists:               │
       │                                  │    delete old attempt     │
       │                                  │    compute net score delta│
       │                                  │                           │
       │                                  │  insert new attempt       │
       │                                  │                           │
       │                                  │  POST /users/internal/    │
       │                                  │    deltas                 │
       │                                  │  { clerkUserId, delta }   │
       │                                  │─────────────────────────▶ │
       │                                  │  score updated            │
       │                                  │◀───────────────────────── │
       │                                  │                           │
       │  201 Created                     │                           │
       │◀──────────────────────────────── │                           │
```

### Request payload

The collaboration service constructs the payload from session state:

| Field | Source |
|---|---|
| `userId` | `socket.data.userId` — the submitting user's Clerk ID |
| `collaborationId` | current collaboration session ID |
| `questionId` | `session.questionId` — from Redis session metadata |
| `questionTitle` | cached in Redis during first `session:join` |
| `language` | `session.language` |
| `difficulty` | `session.difficulty` |
| `success` | `testCasesPassed === totalTestCases && totalTestCases > 0` |
| `duration` | `(Date.now() - session.createdAt) / 1000` in seconds |
| `totalTestCases` | from execution result |
| `testCasesPassed` | from execution result |

### Authentication

The collaboration service authenticates to the attempt service using the shared `x-internal-service-key` header (`INTERNAL_SERVICE_API_KEY` environment variable).

### Upsert behavior

The attempt service enforces a partial unique index on `(clerk_user_id, collaboration_id)` where `collaboration_id IS NOT NULL`. If a user submits multiple times within the same collaboration session:

1. The old attempt for the same `(userId, collaborationId)` pair is deleted
2. The score delta from the old attempt is reversed
3. The new attempt is inserted
4. The net score delta (new minus old) is applied to the user's score

This means only the **latest** submission per session counts toward the user's score.

### Score calculation

| Outcome | Easy | Medium | Hard |
|---|---|---|---|
| Success (all tests pass) | +10 | +30 | +50 |
| Failure (any test fails) | -10 | -10 | -10 |

### Transactional consistency

If the score update call to the user service fails, the attempt service **rolls back** the newly inserted attempt (deletes it). This ensures the attempt table and the user's score stay consistent.

### Error handling in collaboration service

If the attempt recording fails (network error, attempt service down, score update failure), the collaboration service:

- Still considers the code execution successful (results were already broadcast via `output:updated`)
- Acks with `{ ok: false, error: "Code executed but failed to record attempt." }`
- Does **not** emit `submission:complete` to the submitter
- Logs the error for monitoring

### Attempt service endpoints used

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /attempts` | `x-internal-service-key` | Record a new attempt (called by collaboration service) |
| `GET /attempts/me` | User JWT (via Authorization header) | Fetch current user's attempt history (called by frontend) |
| `GET /attempts/users/:clerkUserId/questions` | `x-internal-service-key` | List distinct question IDs attempted by a user (used for question selection deduplication) |

### Attempt data schema

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Auto-generated primary key |
| `clerk_user_id` | TEXT | Clerk user ID |
| `question_id` | TEXT | Question UUID |
| `question_title` | TEXT | Human-readable question title |
| `collaboration_id` | TEXT | Links to collaboration session (nullable, unique per user when non-null) |
| `language` | TEXT | Programming language used |
| `difficulty` | TEXT | `"Easy"` / `"Medium"` / `"Hard"` |
| `success` | BOOLEAN | Whether all test cases passed |
| `duration` | DOUBLE PRECISION | Time spent in seconds |
| `total_test_cases` | INTEGER | Total number of test cases |
| `test_cases_passed` | INTEGER | Number of test cases passed |
| `attempted_at` | TIMESTAMPTZ | When the attempt was made |
| `created_at` | TIMESTAMPTZ | DB insertion timestamp |

---

## 14. Frontend UX Behaviors

### Leave session confirmation

When a user clicks the "Exit Session" button, a confirmation dialog is shown before the `session:leave` event is emitted. This prevents accidental session exits.

### Rejoin banner

When the matching view mounts, the frontend emits `session:check-active` via a dedicated (non-shared) socket. If an active session is found, a banner is displayed with the session topic and difficulty, and a "Rejoin Session" button that navigates to the collaboration view.

### Auto-redirect after successful submission

After a successful code submission (all test cases passed), the frontend shows the success banner for 3 seconds, then automatically leaves the session and navigates back to the dashboard. For failed submissions, a "Return Home" button is shown but no auto-redirect occurs, allowing the user to continue working.

---

## 15. Considerations and Trade-offs

### Could a message broker like RabbitMQ optimise this architecture?

RabbitMQ would help in some specific places but hurt in others. It depends on which part of the system you are looking at.

### Where RabbitMQ would help

**Code execution (`code:run` / `code:submit`)** — this is the strongest case. Right now the collaboration service makes a synchronous HTTP call to the execution service and blocks for up to 60 seconds. With RabbitMQ, it could publish the execution request to a queue and the execution service could consume it at its own pace. Benefits:

- Execution requests get load-balanced across multiple Piston workers automatically
- If the execution service is down, requests queue up instead of failing
- The collaboration service is not holding a connection open for 60 seconds

**Attempt recording** — the `POST /attempts` call after `code:submit` is essentially fire-and-forget from the user's perspective (the code already ran, results already broadcast). Publishing this to a queue would be more resilient — if the attempt service is briefly down, the message waits in the queue instead of being lost.

**Match to session creation handoff** — currently a synchronous `POST /sessions`. If the collaboration service is temporarily overloaded, the matching service gets an error. A queue would buffer these.

### Where RabbitMQ would not help or would hurt

**OT editing loop** — this is the core of the service and needs sub-100ms latency. The current flow is: client sends `code:change`, server transforms, Redis CAS, ack back, broadcast to partner. Adding a message broker in this path would add latency for no benefit. Redis + Socket.IO is already the right tool here.

**Presence and room broadcasting** — Socket.IO rooms already do pub/sub to connected clients. RabbitMQ would be a redundant layer.

**Session join** — needs an immediate synchronous response with the full room state (question, code snapshot, participants). This is request-response, not async.

### Summary

The real-time collaboration core (OT, presence, room events) should stay as-is — Socket.IO + Redis is already well-suited for low-latency bidirectional communication. But the execution pipeline and attempt recording are good candidates for a queue because they are async, slow, and benefit from decoupling and retry resilience.
