# Collaboration Service Documentation

## Overview

The Collaboration Service enables real-time collaborative coding sessions between two matched users. It handles session creation, real-time code synchronization using Operational Transformation (OT), presence management, and session lifecycle.

---

## Table of Contents

1. [Architecture](#architecture)
2. [User Flow](#user-flow)
3. [REST API Endpoints](#rest-api-endpoints)
4. [Socket Events](#socket-events)
5. [Redis Cache](#redis-cache)
6. [Operational Transformation (OT)](#operational-transformation-ot)
7. [Configuration](#configuration)
8. [Data Models](#data-models)
9. [Error Codes](#error-codes)
10. [Files Reference](#files-reference)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  CollaborationSessionView.tsx                                                │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │ useCollaborationSession │  │    OTClient      │  │   UI Components   │  │
│  │ - connection mgmt   │  │ - local operations │  │ - Editor          │  │
│  │ - event handlers    │  │ - server sync      │  │ - Presence        │  │
│  │ - state management  │  │ - offline changes  │  │ - Question        │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                    │ HTTP (REST)              │ WebSocket (Socket.IO)
                    ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COLLABORATION SERVICE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes                                   Sockets                            │
│  ┌────────────────────┐                   ┌────────────────────────────┐    │
│  │ POST /v1/api/sessions │                 │ registerSocketHandlers.ts  │    │
│  │ (internal only)    │                   │ - session:join/leave       │    │
│  └────────────────────┘                   │ - code:change/sync         │    │
│                                           │ - presence events          │    │
│                                           └────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Services                                                                    │
│  ┌────────────────────────────┐  ┌──────────────────────────────────────┐   │
│  │ CollaborationSessionService│  │           OTService                  │   │
│  │ - createSession()          │  │ - transform()                        │   │
│  │ - joinSession()            │  │ - applyOperations()                  │   │
│  │ - leaveSession()           │  │ - OTDocument class                   │   │
│  │ - applyCodeChange()        │  └──────────────────────────────────────┘   │
│  │ - endSession()             │                                             │
│  └────────────────────────────┘                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Repositories                                                                │
│  ┌────────────────────────────┐  ┌──────────────────────────────────────┐   │
│  │ SessionRepository          │  │ SessionPresenceRepository            │   │
│  │ - sessions (Map)           │  │ - socketsBySession (Map)             │   │
│  │ - otDocuments (Map)        │  │ - socketBindings (Map)               │   │
│  │ - output (Map)             │  │ - leftUsers (Set)                    │   │
│  └────────────────────────────┘  │ - sessionLastActivity (Map)          │   │
│                                  └──────────────────────────────────────┘   │
│  ┌────────────────────────────┐                                             │
│  │ SessionCacheRepository     │  ◄─── Redis cache                          │
│  │ - session data caching     │                                             │
│  └────────────────────────────┘                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                          │
                    ▼                          ▼
┌───────────────────────────┐    ┌───────────────────────────────────────────┐
│       User Service        │    │            Question Service               │
│ - batch user validation   │    │ - question selection by topic/difficulty  │
└───────────────────────────┘    └───────────────────────────────────────────┘
```

---

## User Flow

### 1. Session Creation (F4.1)

```
Matching Service                    Collaboration Service
     │                                      │
     │ POST /v1/api/sessions                │
     │ { matchId, userAId, userBId,         │
     │   difficulty, language, topic }      │
     │──────────────────────────────────────▶│
     │                                      │
     │                            ┌─────────┴─────────┐
     │                            │ 1. Validate payload │
     │                            │ 2. Validate users   │◄──── User Service
     │                            │ 3. Select question  │◄──── Question Service
     │                            │ 4. Create session   │
     │                            │ 5. Cache in Redis   │
     │                            └─────────┬─────────┘
     │                                      │
     │◀─────────────────────────────────────│
     │ { session, idempotentHit, cacheWriteSucceeded }
```

### 2. Joining a Session (F4.2)

```
User A                              Collaboration Service
  │                                        │
  │ WebSocket connect (with JWT)           │
  │────────────────────────────────────────▶│
  │                                        │ Validate JWT via User Service
  │◀────────────────────────────────────────│
  │ connection:ready                       │
  │                                        │
  │ session:join { collaborationId }       │
  │────────────────────────────────────────▶│
  │                            ┌───────────┴───────────┐
  │                            │ 1. Validate session    │
  │                            │ 2. Check user assigned │
  │                            │ 3. Add to Socket room  │
  │                            │ 4. Update presence     │
  │                            └───────────┬───────────┘
  │◀────────────────────────────────────────│
  │ { ok: true, state: { session,          │
  │   questionId, codeSnapshot,            │
  │   codeRevision, participants } }       │
  │                                        │
  │                     ┌──────────────────┤
  │                     │ Broadcast to room │
  │                     └──────────────────┤
  │                                        │──────▶ user:joined to User B
  │                                        │──────▶ presence:updated to room
```

### 3. Real-time Code Collaboration (F4.3-F4.5)

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
  │ code:ack { ok: true, rev: 6 } │                               │
  │                               │──────────────────────────────▶│
  │                               │ code:change                   │
  │                               │ { rev: 6, ops: [insert X@10] }│
  │                               │                               │
  │                               │ Both users converge to same   │
  │                               │ document state                │
```

### 4. Handling Disconnections (F4.6)

```
User A disconnects               Server                          User B
  │                               │                               │
  │ ✕ (connection lost)           │                               │
  │                               │ 1. Detect via ping timeout    │
  │                               │ 2. Update A's status to       │
  │                               │    "disconnected"             │
  │                               │ 3. Session stays "active"     │
  │                               │──────────────────────────────▶│
  │                               │ user:disconnected { userId: A }│
  │                               │                               │
  │                               │ User B can continue editing   │
  │                               │ code:change from B accepted   │
```

### 5. Rejoining After Disconnection (F4.7)

```
User A reconnects                Server                          User B
  │                               │                               │
  │ session:join (within grace)   │                               │
  │──────────────────────────────▶│                               │
  │                               │ 1. Check grace period (30s)   │
  │                               │ 2. Return authoritative state │
  │◀──────────────────────────────│                               │
  │ { codeSnapshot: "...",        │                               │
  │   codeRevision: 8,            │                               │
  │   wasDisconnected: true }     │──────────────────────────────▶│
  │                               │ user:joined { wasDisconnected }│
  │                               │                               │
  │ [If offline changes exist]    │                               │
  │ UI shows: "Submit Changes?"   │                               │
  │ ┌─────────────────────────────┤                               │
  │ │ [Submit] or [Discard]       │                               │
  │ └─────────────────────────────┤                               │
```

### 6. Leaving a Session (F4.8)

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
  │                               │                               │
  │                               │ session:ended                 │
  │                               │ { reason: "both_users_left" } │
```

### 7. Session Termination (F4.9)

```
                                Server
                                  │
    ┌─────────────────────────────┼─────────────────────────────┐
    │                             │                             │
    ▼                             ▼                             ▼
Both Users Left            Inactivity Timeout              Manual End
    │                             │                             │
    └─────────────────────────────┼─────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │     endSession()            │
                    ├─────────────────────────────┤
                    │ 1. session.status = inactive│
                    │ 2. Delete OT document       │
                    │ 3. Delete output cache      │
                    │ 4. Delete presence data     │
                    │ 5. Delete socket bindings   │
                    │ 6. Emit session:ended       │
                    └─────────────────────────────┘
                                  │
                                  ▼
              ┌───────────────────────────────────────┐
              │           POST-TERMINATION            │
              │ - joinSession() rejects               │
              │ - applyCodeChange() rejects           │
              │ - Frontend editor disabled            │
              └───────────────────────────────────────┘
```

---

## REST API Endpoints

### Create Session

Creates a new collaboration session after a successful match.

```http
POST /v1/api/sessions
```

**Headers:**
```http
Content-Type: application/json
x-internal-service-key: <internal-service-key>
```

**Request Body:**
```json
{
  "matchId": "match-123",
  "userAId": "user-a",
  "userBId": "user-b",
  "difficulty": "Medium",
  "language": "typescript",
  "topic": "arrays"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `matchId` | string | No | Match identifier from Matching Service |
| `userAId` | string | Yes | First user's ID |
| `userBId` | string | Yes | Second user's ID |
| `difficulty` | enum | Yes | `Easy`, `Medium`, or `Hard` |
| `language` | string | Yes | Programming language |
| `topic` | string | Yes | Question topic |

**Success Response (201 Created):**
```json
{
  "session": {
    "collaborationId": "4f0d95c6-b6e7-4c0e-b38f-2dd5332ed7d7",
    "matchId": "match-123",
    "userAId": "user-a",
    "userBId": "user-b",
    "difficulty": "Medium",
    "language": "typescript",
    "topic": "arrays",
    "questionId": "q-123",
    "status": "active",
    "createdAt": "2026-03-21T15:00:00.000Z"
  },
  "idempotentHit": false,
  "cacheWriteSucceeded": true
}
```

**Idempotent Response (200 OK):**
Returns existing session if same request is made again.

```json
{
  "session": { ... },
  "idempotentHit": true,
  "cacheWriteSucceeded": true
}
```

**Error Responses:**

| Status | Error Code | Description |
|--------|------------|-------------|
| 400 | `INVALID_SESSION_REQUEST` | Missing/invalid fields |
| 401 | `UNAUTHORIZED_INTERNAL_REQUEST` | Invalid internal service key |
| 409 | `ACTIVE_SESSION_CONFLICT` | Active session exists for user pair |
| 424 | `USER_VALIDATION_FAILED` | Users not active |
| 424 | `QUESTION_NOT_FOUND` | No question available |
| 503 | `USER_SERVICE_UNAVAILABLE` | User Service down |
| 503 | `QUESTION_SERVICE_UNAVAILABLE` | Question Service down |

---

## Socket Events

### Connection

#### Authentication

Socket connections require a valid JWT token:

```typescript
// Option 1: In auth object
const socket = io(url, {
  auth: { token: "Bearer <jwt>" }
});

// Option 2: In headers
const socket = io(url, {
  extraHeaders: { authorization: "Bearer <jwt>" }
});
```

#### connection:ready

**Direction:** Server → Client

Emitted when socket is authenticated and ready.

```json
{ "message": "Authenticated and ready" }
```

### Session Events

#### session:join

**Direction:** Client → Server

**Request:**
```json
{ "collaborationId": "collab-123" }
```

**Success Response:**
```json
{
  "ok": true,
  "state": {
    "session": {
      "collaborationId": "collab-123",
      "userAId": "user-a",
      "userBId": "user-b",
      "difficulty": "Medium",
      "language": "typescript",
      "topic": "arrays",
      "questionId": "q-123",
      "status": "active",
      "createdAt": "2026-03-21T12:00:00.000Z"
    },
    "questionId": "q-123",
    "codeSnapshot": "// code here",
    "codeRevision": 5,
    "participants": [
      { "userId": "user-a", "status": "connected", "connectionCount": 1 },
      { "userId": "user-b", "status": "disconnected", "connectionCount": 0 }
    ],
    "isFirstConnection": false,
    "wasDisconnected": true,
    "disconnectDurationMs": 5000
  }
}
```

**Error Response:**
```json
{
  "ok": false,
  "error": "SESSION_ACCESS_DENIED",
  "message": "Authenticated user is not assigned to this collaboration session."
}
```

#### session:leave

**Direction:** Client → Server

**Request:**
```json
{ "collaborationId": "collab-123" }
```

**Response:**
```json
{ "ok": true }
```

#### session:ended

**Direction:** Server → Client

**Payload:**
```json
{
  "collaborationId": "collab-123",
  "reason": "both_users_left" | "inactivity_timeout" | "manual"
}
```

### Presence Events

#### user:joined

**Direction:** Server → Client (broadcast to room)

```json
{
  "collaborationId": "collab-123",
  "userId": "user-a",
  "isFirstConnection": true,
  "wasDisconnected": false
}
```

#### user:disconnected

**Direction:** Server → Client (broadcast to room)

```json
{
  "collaborationId": "collab-123",
  "userId": "user-a",
  "reason": "ping timeout" | "transport close" | "transport error"
}
```

#### user:left

**Direction:** Server → Client (broadcast to room)

```json
{
  "collaborationId": "collab-123",
  "userId": "user-a"
}
```

#### presence:updated

**Direction:** Server → Client (broadcast to room)

```json
{
  "collaborationId": "collab-123",
  "participants": [
    { "userId": "user-a", "status": "connected", "connectionCount": 2 },
    { "userId": "user-b", "status": "disconnected", "connectionCount": 0 }
  ]
}
```

### Code Events (OT-based)

#### code:change

**Direction:** Client → Server

```json
{
  "collaborationId": "collab-123",
  "revision": 5,
  "operations": [
    { "type": "retain", "position": 0, "count": 10 },
    { "type": "insert", "position": 10, "text": "hello" },
    { "type": "delete", "position": 15, "count": 3 }
  ]
}
```

**Direction:** Server → Client (broadcast)

```json
{
  "collaborationId": "collab-123",
  "userId": "user-a",
  "revision": 6,
  "operations": [
    { "type": "insert", "position": 10, "text": "hello" }
  ]
}
```

#### code:ack

**Direction:** Server → Client

```json
{
  "ok": true,
  "revision": 6
}
```

Or on error:
```json
{
  "ok": false,
  "error": "SESSION_INACTIVE",
  "message": "Cannot modify code - session is no longer active."
}
```

#### code:sync

**Direction:** Server → Client

Full sync when client is too far behind.

```json
{
  "collaborationId": "collab-123",
  "code": "// full code content",
  "revision": 10
}
```

### Output Events

#### output:updated

**Direction:** Server → Client (broadcast to room)

```json
{
  "collaborationId": "collab-123",
  "output": "Test passed!\n"
}
```

---

## Redis Cache

### Key Format

```
{redisKeyPrefix}session:{collaborationId}
```

Default prefix: `collaboration-service:`

Example: `collaboration-service:session:4f0d95c6-b6e7-4c0e-b38f-2dd5332ed7d7`

### Stored Fields

| Field | Type | Description |
|-------|------|-------------|
| `collaborationId` | string | Unique session identifier |
| `matchId` | string | Match identifier (optional) |
| `userAId` | string | First user's ID |
| `userBId` | string | Second user's ID |
| `difficulty` | string | Easy, Medium, or Hard |
| `language` | string | Programming language |
| `topic` | string | Question topic |
| `questionId` | string | Selected question ID |
| `status` | string | active or inactive |
| `createdAt` | string | ISO timestamp |

### TTL

Controlled by `CS_SESSION_TTL_MS` (default: 1 hour)

### Cache Behavior

- Cache write failure does not fail session creation
- `cacheWriteSucceeded` in response indicates cache status
- Cache is for acceleration/recovery, not source of truth

---

## Operational Transformation (OT)

### Operation Types

| Type | Fields | Description |
|------|--------|-------------|
| `insert` | `position`, `text` | Insert text at position |
| `delete` | `position`, `count` | Delete count characters at position |
| `retain` | `position`, `count` | Skip count characters (no-op) |

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

### Transformation Rules

When operations conflict, transform to maintain consistency:

| Op A | Op B | Transformation |
|------|------|----------------|
| Insert at X | Insert at Y (Y > X) | B's position shifts by A's text length |
| Insert at X | Insert at X | Priority determines order |
| Insert at X | Delete at Y | Adjust positions based on overlap |
| Delete at X | Delete at Y | Handle overlapping deletions |

### Convergence Example

```
Initial: "hello" (rev 0)

User A: Insert "X" at position 0
User B: Insert "Y" at position 5

Server receives A first:
  - Apply A: "Xhello" (rev 1)
  - Receive B (at rev 0): Transform position 5 → 6
  - Apply B: "XhelloY" (rev 2)

Both clients receive transformed operations and converge to "XhelloY"
```

### Server-side Document

```typescript
class OTDocument {
  private content: string;
  private revision: number;
  private pendingOperations: Map<number, HistoryEntry>;  // Last 50 revisions

  applyClientOperations(userId, clientRevision, operations) {
    // Transform against all ops since client's revision
    let transformed = operations;
    for (let rev = clientRevision + 1; rev <= this.revision; rev++) {
      transformed = transform(transformed, this.pendingOperations.get(rev));
    }

    this.content = applyOperations(this.content, transformed);
    this.revision++;

    return { transformed, newRevision: this.revision };
  }
}
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CS_SERVER_PORT` | 3003 | Server port |
| `CS_FRONTEND_URL` | http://localhost:5173 | CORS origin |
| `CS_LOG_LEVEL` | info | Logging level |
| `CS_SESSION_TTL_MS` | 3600000 (1h) | Session TTL in Redis |
| `CS_DEPENDENCY_TIMEOUT_MS` | 5000 | External service timeout |
| `CS_DISCONNECT_GRACE_MS` | 30000 (30s) | Reconnection grace period |
| `CS_HEARTBEAT_INTERVAL_MS` | 25000 (25s) | Socket.IO ping interval |
| `CS_HEARTBEAT_TIMEOUT_MS` | 20000 (20s) | Socket.IO ping timeout |
| `CS_SESSION_INACTIVITY_TIMEOUT_MS` | 1800000 (30m) | Session inactivity timeout |
| `CS_INACTIVITY_CHECK_INTERVAL_MS` | 60000 (1m) | Inactivity check interval |
| `CS_API_GATEWAY_URL` | http://localhost:8080 | API Gateway URL |
| `CS_INTERNAL_SERVICE_API_KEY` | | Internal service auth key |
| `CS_USER_AUTH_CONTEXT_PATH` | /v1/api/users/internal/authz/context | User auth context endpoint |
| `CS_USER_AUTH_BATCH_PATH` | /v1/api/users/internal/validation/batch | User batch validation endpoint |
| `CS_QUESTION_SELECTION_PATH` | /v1/api/questions/internal/select | Question selection endpoint |
| `CS_USE_QUESTION_STUB` | false | Use stub questions |
| `CS_REDIS_HOST` | 127.0.0.1 | Redis host |
| `CS_REDIS_PORT` | 6379 | Redis port |
| `CS_REDIS_DB` | 0 | Redis database |
| `CS_REDIS_KEY_PREFIX` | collaboration-service: | Redis key prefix |

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

### PresenceStatus

```typescript
type PresenceStatus = "connected" | "disconnected" | "left";
```

### SessionParticipantPresence

```typescript
type SessionParticipantPresence = {
  userId: string;
  status: PresenceStatus;
  connectionCount: number;
};
```

### OTOperation

```typescript
type OTOperation = {
  type: "insert" | "delete" | "retain";
  position: number;
  text?: string;   // For insert
  count?: number;  // For delete/retain
};
```

### RoomState

```typescript
type RoomState = {
  collaborationId: string;
  questionId: string;
  code: string;
  codeRevision: number;
  language: string;
  output: string;
  participants: SessionParticipantPresence[];
};
```

### CollaborationJoinState

```typescript
type CollaborationJoinState = {
  session: CollaborationSession;
  questionId: string;
  codeSnapshot: string;
  codeRevision: number;
  participants: SessionParticipantPresence[];
  isFirstConnection: boolean;
  wasDisconnected: boolean;
  disconnectDurationMs: number;
};
```

---

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_SESSION_REQUEST` | 400 | Invalid request payload |
| `UNAUTHORIZED_INTERNAL_REQUEST` | 401 | Invalid internal service key |
| `SOCKET_AUTHENTICATION_FAILED` | 401 | JWT validation failed |
| `SESSION_ACCESS_DENIED` | 403 | User not assigned to session |
| `REJOIN_GRACE_PERIOD_EXPIRED` | 403 | Reconnection timeout exceeded |
| `SESSION_NOT_FOUND` | 404 | Session doesn't exist |
| `SESSION_INACTIVE` | 409 | Session is no longer active |
| `ACTIVE_SESSION_CONFLICT` | 409 | Active session exists for pair |
| `SESSION_CAPACITY_REACHED` | 409 | Session already has 2 users |
| `INVALID_JOIN_REQUEST` | 400 | Missing collaborationId |
| `USER_VALIDATION_FAILED` | 424 | User validation failed |
| `QUESTION_NOT_FOUND` | 424 | No matching question |
| `USER_SERVICE_UNAVAILABLE` | 503 | User Service unreachable |
| `QUESTION_SERVICE_UNAVAILABLE` | 503 | Question Service unreachable |

---

## Files Reference

### Backend (collaborationService)

```
src/
├── app.ts                              # Express app setup
├── index.ts                            # Server + Socket.IO initialization
├── config/
│   ├── constants.ts                    # HTTP status, error codes, socket events
│   └── env.ts                          # Environment configuration
├── middleware/
│   ├── errorHandler.ts                 # Global error handling
│   ├── internalServiceAuth.ts          # Internal API authentication
│   └── socketAuth.ts                   # Socket.IO JWT authentication
├── models/
│   └── session.ts                      # TypeScript types
├── repositories/
│   ├── sessionRepository.ts            # Session + OT document storage
│   ├── sessionPresenceRepository.ts    # Presence + socket tracking
│   └── sessionCacheRepository.ts       # Redis cache operations
├── routes/
│   └── sessionRoutes.ts                # REST API routes
├── services/
│   ├── collaborationSessionService.ts  # Core session logic
│   ├── otService.ts                    # OT algorithm implementation
│   ├── userValidationService.ts        # User Service integration
│   ├── questionSelectionService.ts     # Question Service integration
│   └── validation.ts                   # Request validation
└── sockets/
    └── registerSocketHandlers.ts       # Socket event handlers
```

### Frontend

```
src/
├── models/collaboration/
│   ├── collaborationType.ts            # Type definitions
│   └── collaborationSocketType.ts      # Socket event constants
├── services/collaboration/
│   ├── collaborationService.ts         # Socket.IO client wrapper
│   ├── otClient.ts                     # Client-side OT implementation
│   └── useCollaborationSession.ts      # React hook for session state
└── views/collaboration/
    └── CollaborationSessionView.tsx    # Main collaboration UI
```

---

## Data Retention

| Data Type | Storage | On Session End |
|-----------|---------|----------------|
| Session record | In-memory Map | **Kept** (for history) |
| OT document (code) | In-memory Map | **Deleted** |
| Output cache | In-memory Map | **Deleted** |
| Presence data | In-memory Map | **Deleted** |
| Socket bindings | In-memory Map | **Deleted** |
| Redis cache | Redis | Expires via TTL |

---

## Dependency Contracts

### User Service - Batch Validation

**Endpoint:** `{CS_API_GATEWAY_URL}{CS_USER_AUTH_BATCH_PATH}`

**Request:**
```json
{
  "userIds": ["user-a", "user-b"]
}
```

**Response:**
```json
{
  "data": {
    "users": [
      { "userId": "user-a", "status": "active" },
      { "userId": "user-b", "status": "active" }
    ]
  }
}
```

### User Service - Auth Context (Socket Auth)

**Endpoint:** `{CS_API_GATEWAY_URL}{CS_USER_AUTH_CONTEXT_PATH}`

Validates JWT and returns user context.

### Question Service - Selection

**Endpoint:** `{CS_API_GATEWAY_URL}{CS_QUESTION_SELECTION_PATH}`

**Request:**
```json
{
  "topic": "arrays",
  "difficulty": "Medium",
  "userAId": "user-a",
  "userBId": "user-b"
}
```

**Response:**
```json
{
  "data": {
    "question": {
      "questionId": "q-123",
      "title": "Two Sum",
      "topic": "arrays",
      "difficulty": "Medium"
    }
  }
}
```
