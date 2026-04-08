# RabbitMQ Integration: Collaboration Service

## Overview

The collaboration service now consumes session creation requests from the matching service via RabbitMQ, replacing the need for direct HTTP calls. This decouples the two services so they can fail independently and scale separately.

## Message Flow

```
Matching Service                    RabbitMQ                      Collaboration Service
      |                                |                                  |
      |-- match found ---------------→|                                  |
      |   publish CreateSessionRequest |                                  |
      |   to collab_create_req_queue   |                                  |
      |                                |--→ consume from req queue ------→|
      |                                |                                  |
      |   emit match_preparing         |    1. Validate users (User Svc)  |
      |   to both users via Socket.IO  |    2. Select question (Q Svc)    |
      |                                |    3. Create session in Redis    |
      |                                |    4. Initialize OT document     |
      |                                |                                  |
      |                                |←-- publish CreateSessionResponse |
      |                                |    to collab_create_res_queue    |
      |←-- consume from res queue -----|                                  |
      |                                                                   |
      |   emit match_success                                              |
      |   to both users via Socket.IO                                     |
      |   (includes collaborationId)                                      |
```

## Queues

| Queue | Direction | Message Type |
|-------|-----------|-------------|
| `collab_create_req_queue` | Matching -> Collaboration | `CreateSessionRequest` |
| `collab_create_res_queue` | Collaboration -> Matching | `CreateSessionResponse` |

Both queues are **durable** (survive broker restarts) and messages are **persistent** (written to disk).

### Request Message (`collab_create_req_queue`)

```json
{
  "matchId": "uuid-string",
  "userAId": "clerk-user-id",
  "userBId": "clerk-user-id",
  "difficulty": "Easy | Medium | Hard",
  "language": "Python",
  "topic": "algorithms"
}
```

### Response Message (`collab_create_res_queue`)

```json
{
  "session": {
    "collaborationId": "uuid",
    "matchId": "uuid",
    "userAId": "clerk-user-id",
    "userBId": "clerk-user-id",
    "difficulty": "Easy | Medium | Hard",
    "language": "Python",
    "topic": "algorithms",
    "questionId": "uuid",
    "status": "active",
    "createdAt": "ISO-8601"
  },
  "idempotentHit": false,
  "cacheWriteSucceeded": true
}
```

## Files Changed

### New Files

| File | Purpose |
|------|---------|
| `src/types/rabbitmq.ts` | Queue name constants (`REQ_QUEUE`, `RES_QUEUE`) |
| `src/managers/rabbitmqManager.ts` | Singleton RabbitMQ manager (consumer + publisher) |

### Modified Files

| File | Change |
|------|--------|
| `package.json` | Added `amqplib` and `@types/amqplib` dependencies |
| `src/config/env.ts` | Added `rabbitmqUrl` from `CS_RABBITMQ_URL` env var |
| `src/config/constants.ts` | Added `NON_RETRYABLE_ERROR_CODES` set and `RABBITMQ_DEFAULTS` |
| `src/index.ts` | Initialize RabbitMQ connection on startup |
| `src/utils/redisAdapter.ts` | Fixed pre-existing ioredis v5 type errors |
| `docker-compose.yml` | Added `rabbitmq-network`, `depends_on: rabbitmq`, and `CS_RABBITMQ_URL` env var |

## Error Handling

The consumer categorizes errors to decide whether to retry or discard:

| Error Type | Action | Rationale |
|------------|--------|-----------|
| Invalid JSON (poison message) | Ack & discard | Retrying won't fix bad data |
| Validation failure | Ack & discard | Structurally invalid payload |
| `ACTIVE_SESSION_CONFLICT` | Ack & discard | Session already exists for this pair |
| `USER_VALIDATION_FAILED` | Ack & discard | Users don't exist or are inactive |
| `QUESTION_NOT_FOUND` | Ack & discard | No matching question available |
| `QUESTION_SERVICE_UNAVAILABLE` | Retry (up to 5x) | Transient dependency failure |
| `USER_SERVICE_UNAVAILABLE` | Retry (up to 5x) | Transient dependency failure |
| Other errors | Retry (up to 5x) | Assumed transient |
| Max retries exceeded | Nack & discard | Final discard after 5 attempts |

Retries are tracked via the `x-retry-count` message header. The message is re-published to the same queue with an incremented count.

## Connection Resilience

- Auto-reconnect on connection loss with a 5-second delay
- `isReconnecting` guard prevents concurrent reconnection attempts
- `prefetch(1)` ensures only one message is processed at a time

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `CS_RABBITMQ_URL` | `amqp://localhost:5672` | RabbitMQ connection URL |

In Docker, this is set to `amqp://rabbitmq:5672` via `docker-compose.yml`.

## No Frontend Changes Required

The frontend already handles the full handoff:

1. `match_preparing` -- shows "Setting up your workspace..." animation
2. `match_success` with `collaborationId` -- navigates to `/collaboration/:id`
3. `session:join` -- joins the room, loads question, initializes the code editor
