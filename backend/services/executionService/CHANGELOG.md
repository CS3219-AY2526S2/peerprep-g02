# feat/exec-rabbitmq — Branch Changelog

## Overview

This branch introduces **RabbitMQ-based code execution**, **AI-powered hints via Gemini**, and a collection of bug fixes across the collaboration, execution, question, and user services.

---

## 1. RabbitMQ Code Execution Pipeline

Replaces the previous direct HTTP execution flow with an asynchronous message queue.

### Execution Service

- **New:** `src/managers/rabbitmqManager.ts` — RabbitMQ consumer that listens on `exec_req_queue`, runs code via Piston, and publishes results to `exec_res_queue`. Includes retry logic with `x-retry-count` headers, reconnection on connection loss, and message validation.
- **New:** `src/types/rabbitmq.ts` — Shared types for `ExecutionRequestMessage` and `ExecutionResponseMessage`.
- **Updated:** `src/config/constants.ts` — Added `RABBITMQ_DEFAULTS` (prefetch, max retries, reconnect delay).
- **Updated:** `src/config/env.ts` — Added `RABBITMQ_URL` env var.
- **Updated:** `src/index.ts` — Connects to RabbitMQ on startup.
- **Updated:** `package.json` — Added `amqplib` dependency.
- **Fix:** Normalize `language` to lowercase before validation to prevent "unsupported language" errors from case mismatch (e.g. `"Python"` vs `"python"`).

### Collaboration Service

- **New:** `src/types/executionRabbitmq.ts` — Execution message types mirrored for the collaboration service.
- **Updated:** `src/managers/rabbitmqManager.ts` — Extended to consume `exec_res_queue` responses, broadcast results to Socket.IO rooms, and record submission attempts via `AttemptRecordingService`. Includes a 65-second timeout safety net using a Redis `exec:pending:{correlationId}` key.
- **Updated:** `src/sockets/registerSocketHandlers.ts` — `CODE_RUN` and `CODE_SUBMIT` handlers now publish to RabbitMQ instead of calling the execution service directly.

### Docker Compose

- Execution service now depends on `rabbitmq` (healthy) and joins `rabbitmq-network`.
- Added `RABBITMQ_URL` environment variable.

---

## 2. AI Hints (Gemini Integration)

Allows users to request up to 2 AI-generated hints per session during collaboration.

### Backend (Collaboration Service)

- **New:** `src/services/aiHintService.ts` — Calls the Gemini 2.5 Flash REST API with a tailored prompt that analyzes the user's current code against the problem description. Includes 15-second timeout via `AbortController`. Prompt differentiates between "has code" (points out specific bugs/missing logic) and "no code" (suggests algorithm/technique).
- **New:** `src/repositories/redisHintRepository.ts` — Redis-backed storage for hints per session. Tracks per-user hint count with a max of 2. Keys: `hints:{collaborationId}` (list), `hints:count:{collaborationId}:{userId}` (counter).
- **Updated:** `src/config/constants.ts` — Added `HINT_REQUEST`, `HINT_UPDATED` socket events; `HINT_LIMIT_REACHED`, `HINT_GENERATION_FAILED` error codes; `MAX_HINTS_PER_USER: 2`.
- **Updated:** `src/config/env.ts` — Added `CS_GEMINI_API_KEY`.
- **Updated:** `src/services/collaborationSessionService.ts` — Added `requestHint()`, `getHints()`, `getHintsRemaining()` methods. Hints are cleaned up in `endSession()`.
- **Updated:** `src/sockets/registerSocketHandlers.ts` — Added `hint:request` handler with rate limiting, Gemini call, and `hint:updated` broadcast to room. Wrapped in try-catch so ack always fires.

### Frontend

- **New:** `src/models/collaboration/aiHintType.ts` — `AiHint`, `HintRequestAck`, `HintUpdatedPayload` types.
- **Updated:** `src/models/collaboration/collaborationSocketType.ts` — Added `HINT_REQUEST`, `HINT_UPDATED` events.
- **Updated:** `src/services/collaboration/collaborationService.ts` — Added `requestHint()` with 20-second client-side timeout.
- **Updated:** `src/services/collaboration/useCollaborationSession.ts` — Added `hints`, `isHintLoading`, `hintsRemaining`, `requestHint` state and handlers. Listens for `hint:updated` broadcasts.
- **Updated:** `src/views/collaboration/CollaborationSessionView.tsx` — Added AI Hints panel (bottom-right) with hint list, "Get Hint" button, loading spinner, and remaining hint count badge.

---

## 3. UI/UX Improvements

### Collaboration View (`CollaborationSessionView.tsx`)

- Swapped AI Hints panel (now bottom-right) and chat panel (now left column below examples).
- Replaced session ID in header with `difficulty · topic` display.
- Removed duplicate connection badge above code editor (kept on left side only).
- Disabled Run/Submit buttons when disconnected (`connectionState !== "connected"`).
- Display usernames instead of user IDs throughout (participant cards, hint attribution, notifications).

### Username Resolution

- **Backend:** `collaborationSessionService.getUserNames()` fetches display names from the user service via `validateUsers()`. Returned in the join ack as `userNames`.
- **Backend:** `InternalUserValidationController.ts` — Now includes `name` in the validation response.
- **Frontend:** `useCollaborationSession.ts` — Stores `userNames` from join ack, uses them for partner notifications (join/disconnect/left).
- **Frontend:** `CollaborationSessionView.tsx` — `getDisplayName()` helper resolves user IDs to names.

### Notifications

- Removed duplicate toast notifications for partner events (kept inline badge only).
- Partner join/disconnect/left messages use display names.

---

## 4. Bug Fixes

### Topic Badges Showing UUIDs

- **`questionService/src/services/questionDatabase.ts`** — `GetQuestion()` now joins the `topics` table to resolve UUID arrays into human-readable topic names via SQL subquery.
- **`questionService/src/routes/internalRoutes.ts`** — Returns `topic_names` instead of raw UUID array.

### Rejoin Session Showing After Grace Period

- **`redisPresenceRepository.ts`** — `canRejoinWithinGracePeriod()` now checks `scard` on the sockets set when presence data is empty, distinguishing "first join" from "expired data".
- **`collaborationSessionService.ts`** — `getActiveSessionForUser()` now also checks session status (rejects inactive sessions) and clears the active-session index when the user has explicitly left.

### Multi-Tab Leave Session

- **`collaborationSessionService.ts`** — `leaveSession()` now removes only the single leaving socket (not all tabs). Checks remaining sockets via `getUserSocketIds()` and only marks the user as "left" when their last socket closes.
- **`registerSocketHandlers.ts`** — Only broadcasts `USER_LEFT` when `isLastSocket` is true.
- **`session.ts`** — Added `isLastSocket` to `LeaveSessionResult` type.

### Redis Type

- **`src/utils/redis.ts`** — Added `scard` to `RedisClient` type definition.

---

## Environment Variables

| Variable | Service | Description |
|---|---|---|
| `RABBITMQ_URL` | Execution Service | RabbitMQ connection URL (e.g. `amqp://rabbitmq:5672`) |
| `CS_GEMINI_API_KEY` | Collaboration Service | Google Gemini API key for AI hints |

---

## Files Changed (33 files, +1526 / -251)

### New Files
- `backend/services/collaborationService/src/services/aiHintService.ts`
- `backend/services/collaborationService/src/repositories/redisHintRepository.ts`
- `backend/services/collaborationService/src/types/executionRabbitmq.ts`
- `backend/services/executionService/src/managers/rabbitmqManager.ts`
- `backend/services/executionService/src/types/rabbitmq.ts`
- `frontend/src/models/collaboration/aiHintType.ts`

### Modified Files
- `backend/services/collaborationService/.env.example`
- `backend/services/collaborationService/src/config/constants.ts`
- `backend/services/collaborationService/src/config/env.ts`
- `backend/services/collaborationService/src/index.ts`
- `backend/services/collaborationService/src/managers/rabbitmqManager.ts`
- `backend/services/collaborationService/src/models/session.ts`
- `backend/services/collaborationService/src/repositories/redisPresenceRepository.ts`
- `backend/services/collaborationService/src/repositories/redisSessionRepository.ts`
- `backend/services/collaborationService/src/services/collaborationSessionService.ts`
- `backend/services/collaborationService/src/sockets/registerSocketHandlers.ts`
- `backend/services/collaborationService/src/utils/redis.ts`
- `backend/services/executionService/.env.example`
- `backend/services/executionService/package.json`
- `backend/services/executionService/package-lock.json`
- `backend/services/executionService/src/config/constants.ts`
- `backend/services/executionService/src/config/env.ts`
- `backend/services/executionService/src/index.ts`
- `backend/services/questionService/src/routes/internalRoutes.ts`
- `backend/services/questionService/src/services/questionDatabase.ts`
- `backend/services/userService/controllers/InternalUserValidationController.ts`
- `docker-compose.yml`
- `frontend/src/models/collaboration/collaborationSocketType.ts`
- `frontend/src/services/collaboration/collaborationService.ts`
- `frontend/src/services/collaboration/useCollaborationSession.ts`
- `frontend/src/views/collaboration/CollaborationSessionView.tsx`
