[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/HpD0QZBI)

# CS3219 Project (PeerPrep) - AY2526S2

## Group: G02

PeerPrep is a real-time collaborative platform designed to help students ace their technical interviews. By matching users based on their proficiency, preferred programming language, and topic, PeerPrep provides an isolated, synchronized workspace to solve algorithmic challenges together.

---

## Team Members (Group 02)

- Kevin Limantoro (A0276912X)
- V Varsha (A0286877B)
- Kenny Lewi (A0281398N)
- Low Hsin Yi (A0278079L)

---

## Table of Contents

- [System Architecture](#system-architecture)
- [High-Level Overview](#high-level-overview)
- [Network Isolation](#network-isolation)
- [Quick Start](#quick-start-local-development)
- [Authentication Architecture](#authentication-architecture)
- [Microservices Documentation](#microservices-documentation)
  - [User Service](#1-user-service)
  - [Matching Service](#2-matching-service)
  - [Question Service](#3-question-service)
  - [Collaboration Service](#4-collaboration-service)
  - [Execution Service](#5-execution-service)
  - [Attempt Service](#6-attempt-service)
- [Inter-Service Flows](#inter-service-flows--integrations)
- [CI/CD Pipeline](#cicd-pipeline)

---

## System Architecture

### High-Level Overview

The system follows a **microservices architecture** with an Nginx API gateway, three PostgreSQL databases, two Redis instances, and RabbitMQ for asynchronous messaging.

```
                                    PeerPrep System Architecture
                                    ===========================

    +------------------+
    |   React + Vite   |  :5173
    |    (Frontend)    |
    +--------+---------+
             |
             | HTTP / WebSocket
             v
    +--------+---------+
    |   Nginx Gateway  |  :8080          +----------+
    |  (API Gateway)   +---------------->|  Ngrok   |  :4040
    +--------+---------+                 | (Tunnel) |
             |                           +----------+
             | Routes requests by URL prefix:
             |
             | /v1/api/us/*    /v1/api/ms/*    /v1/api/qs/*    /v1/api/cs/*    /v1/api/as/*
             |
    +--------+--------+-----------+-----------+-----------+
    |        |        |           |           |           |
    v        v        v           v           v           v
+------+ +------+ +------+  +-------+  +-------+  +-------+
| User | |Match | | Ques |  |Collab |  |Attempt|  | Exec  |
| Svc  | | Svc  | | Svc  |  |  Svc  |  |  Svc  |  |  Svc  |
| :3001| | :3002| | :3005|  | :3003 |  | :3004 |  | :3006 |
+--+---+ +--+---+ +--+---+  +---+---+  +---+---+  +---+---+
   |        |        |           |          |           |
   v        v        v           v          v           v
+------+ +------+ +------+  +-------+  +-------+  +-------+
|Postgr| |Redis | |Postgr|  | Redis |  |Postgr |  |Piston |
| :5433| |      | | :5435|  |       |  | :5436 |  | :2000 |
+------+ +------+ +------+  +-------+  +-------+  +-------+

                    +-------------------+
                    |     RabbitMQ      |  :5672 (AMQP) / :15672 (UI)
                    | (Message Broker)  |
                    +---------+---------+
                              |
                  +-----------+-----------+
                  |                       |
            Matching Svc           Collaboration Svc
          (publishes to REQ)      (consumes from REQ,
                                   publishes to RES)
```

### Service Communication Map

This diagram shows how each service communicates and what protocols they use.

```
                         Service Communication Patterns
                         ==============================

  +----------+    REST (JWT in header)    +-------------------+
  |          +--------------------------->| Nginx API Gateway |
  | Frontend |                            +--------+----------+
  |          +--------------------------->|        |
  +----------+  WebSocket (JWT in auth)   |        |
                                          |  Routes to services
                                          |
     +------------------------------------+------------------------------------+
     |                |                |                |                |
     v                v                v                v                v
+---------+    +-----------+    +-----------+    +----------+     +----------+
|  User   |    | Matching  |    | Question  |    | Collab   |     | Attempt  |
| Service |    |  Service  |    |  Service  |    | Service  |     | Service  |
+---------+    +-----------+    +-----------+    +----------+     +----------+
     ^              |  ^              ^               |  |  |           ^
     |              |  |              |               |  |  |           |
     +--------------+  |              +---------------+  |  +-----------+
     | x-internal-     |              | x-internal-      |
     | service-key     |              | service-key      |
     | (auth context)  |              | (select question) |
     |                 |                                  |
     |          +------+------+                    +------+------+
     |          |  RabbitMQ   |                    |  Execution  |
     |          | (REQ / RES  |                    |   Service   |
     |          |   Queues)   |                    +------+------+
     |          +------+------+                           |
     |                 |                            +-----+-----+
     |                 v                            |  Piston   |
     |          Collaboration Svc                   | (Sandbox) |
     |          (consumes & responds)               +-----------+
     |
     +--- Also called by: Matching Svc, Collab Svc, Attempt Svc
          (all validate user auth via User Service internally)


  Legend:
  ------
  REST (sync)        ------->
  WebSocket          =======>
  AMQP (async)       - - - ->
  Internal REST      ------->  (with x-internal-service-key header)
```

### Network Isolation

Docker Compose defines **7 isolated bridge networks** to enforce strict service boundaries. Each database is only accessible by its owning service.

```
                          Docker Network Topology
                          =======================

  +------------------------------------------------------------------+
  |                       gateway-network                            |
  |                                                                  |
  |  +----------+  +-------+  +---------+  +--------+  +---------+  |
  |  | Frontend |  | Nginx |  |  Ngrok  |  | Piston |  |  Exec   |  |
  |  +----------+  +-------+  +---------+  +--------+  |  Svc    |  |
  |                                                     +---------+  |
  |  +----------+  +---------+  +---------+  +--------+ +--------+  |
  |  |  User    |  | Match   |  |Question |  | Collab | |Attempt |  |
  |  |  Svc     |  |  Svc    |  |  Svc    |  |  Svc   | |  Svc   |  |
  |  +----+-----+  +--+---+--+  +----+----+  +--+--+--+ +---+----+  |
  +-------|------------|---|----------|----------|--|---------|-------+
          |            |   |         |          |  |         |
  +-------+------+  +--+--+---+  +--+-------+  +--+------+  +---+--------+
  |user-db-network|  |matching- |  |questions-|  |collab-  |  |attempts-   |
  |              |  |redis-net |  |db-network|  |redis-net|  |db-network  |
  | +----------+ |  | +------+ |  | +------+ |  | +-----+|  | +--------+ |
  | | Postgres | |  | | Redis| |  | |Postgr| |  | |Redis||  | |Postgres| |
  | |  (User)  | |  | +------+ |  | +------+ |  | +-----+|  | |(Atmpt) | |
  | +----------+ |  +----------+  | +------+ |  +--------+  | +--------+ |
  +--------------+                | |pgAdmin| |              +------------+
                                  | +------+ |
                                  +----------+
                                               +-------------------+
                                               |  rabbitmq-network |
                                               |  +-------------+  |
                                               |  |  RabbitMQ   |  |
                                               |  +-------------+  |
                                               | Matching Svc      |
                                               | Collaboration Svc |
                                               +-------------------+
```

---

## Quick Start (Local Development)

### Prerequisites

- Docker and Docker Compose
- Node.js (v18+)
- A [Clerk](https://clerk.com/) account (for authentication)

### Environment Setup

Each service requires its own `.env` file. Reference the `.env.example` files where available:

```
peerprep-g02/
  .env                                      # NGROK_AUTHTOKEN
  frontend/.env                             # VITE_GATEWAY_ENDPOINT, VITE_CLERK_PUBLISHABLE_KEY
  backend/services/userService/.env         # Clerk keys, DB config
  backend/services/matchingService/.env     # Redis, RabbitMQ, GCP Pub/Sub config
  backend/services/questionService/.env     # DB config, internal service keys
  backend/services/collaborationService/.env # Redis, RabbitMQ, session config
  backend/services/executionService/.env    # Piston config
  backend/services/attemptService/.env      # DB config, User Service URL
```

### Running the System

```bash
# Clone the repository
git clone https://github.com/CS3219-AY2526S2/peerprep-g02.git
cd peerprep-g02

# Build and spin up all 17 containers
docker-compose up --build
```

Once running, the following UIs are available:

| Service             | URL                    | Description                            |
| ------------------- | ---------------------- | -------------------------------------- |
| Frontend            | http://localhost:5173  | PeerPrep web application               |
| API Gateway         | http://localhost:8080  | Nginx reverse proxy                    |
| RabbitMQ Management | http://localhost:15672 | Message broker dashboard (guest/guest) |
| pgAdmin             | http://localhost:5050  | PostgreSQL admin GUI                   |
| Dozzle              | http://localhost:8888  | Real-time Docker log viewer            |
| Ngrok Inspector     | http://localhost:4040  | Tunnel traffic inspector               |

> **Note:** Database seeding and migrations run automatically on startup.

---

## Authentication Architecture

PeerPrep uses [Clerk](https://clerk.com/) as its identity provider with a layered auth strategy.

```
                       Authentication Flow
                       ====================

  +----------+     1. Sign in via Clerk      +----------+
  |          | ----------------------------> |  Clerk   |
  |  Client  | <---------------------------- | (OAuth)  |
  |          |     2. Receive JWT token      +----------+
  +----+-----+
       |
       | 3. Every request includes:
       |    Authorization: Bearer <JWT>
       v
  +----+------+
  |   Nginx   |  Forwards auth headers as-is
  |  Gateway  |
  +----+------+
       |
       +--------> For HTTP routes:
       |          Service uses @clerk/express to validate JWT
       |          Then checks user role (admin, super_user, regular)
       |
       +--------> For WebSocket connections:
                  JWT passed in Socket.IO auth handshake
                  Service calls User Service internal endpoint:
                  GET /users/internal/authz/context
                  (validated via x-internal-service-key header)

  +----------------------------------------------------------------+
  |                  Internal Service Auth                          |
  |                                                                |
  |  Service A  ---[x-internal-service-key: <shared-secret>]--->   |
  |                                                Service B       |
  |                                                                |
  |  Used for: question selection, attempt recording,              |
  |            code execution, user auth context lookups            |
  +----------------------------------------------------------------+
```

### Auth Layers Summary

| Layer                 | Mechanism                              | Used By                  |
| --------------------- | -------------------------------------- | ------------------------ |
| Frontend -> Gateway   | Clerk JWT in `Authorization` header    | All client requests      |
| Gateway -> Service    | JWT forwarded, validated by Clerk SDK  | HTTP endpoints           |
| Client -> WebSocket   | JWT in Socket.IO `auth` object         | Matching & Collaboration |
| Service -> Service    | `x-internal-service-key` shared secret | All internal calls       |
| Clerk -> User Service | Webhook signatures                     | User lifecycle events    |

---

## Microservices Documentation

### 1. User Service

Manages user accounts, roles, and authentication. Acts as the **centralized auth authority** for the entire system -- no other service validates JWTs directly; they all delegate to the User Service.

#### Tech Stack

- **Runtime:** Node.js / TypeScript
- **Framework:** Express 4
- **Database:** PostgreSQL 16
- **Auth Provider:** [Clerk](https://clerk.com/) (`@clerk/express`)
- **Logging:** Pino
- **API Docs:** Swagger (dev mode at `/docs`)

#### API Routes

| Method   | Endpoint                           | Auth     | Description                                |
| -------- | ---------------------------------- | -------- | ------------------------------------------ |
| `GET`    | `/users/me`                        | User     | Get or bootstrap current user              |
| `DELETE` | `/users/me`                        | User     | Delete own account (from Clerk + local DB) |
| `GET`    | `/users/admin/users`               | Admin    | List all users with emails from Clerk      |
| `PATCH`  | `/users/admin/users/:id/role`      | Admin    | Promote/demote user (audit logged)         |
| `PATCH`  | `/users/admin/users/:id/status`    | Admin    | Suspend/unsuspend user (synced to Clerk)   |
| `POST`   | `/users/webhooks/clerk`            | Webhook  | Clerk lifecycle events (Svix-verified)     |
| `GET`    | `/users/internal/authz/context`    | Internal | Auth context for other services            |
| `POST`   | `/users/internal/validation/batch` | Internal | Batch validate user statuses               |
| `POST`   | `/users/internal/deltas`           | Internal | Apply score changes (transactional)        |

#### JWT Authentication Flow

Clerk issues JWTs that the User Service validates on behalf of the entire system:

```
                         JWT Validation Flow
                         ====================

  Client Request                 User Service                    Clerk
  ==============                 ============                    =====
       |                              |                            |
       | Authorization: Bearer <JWT>  |                            |
       +----------------------------->|                            |
       |                              |  clerkMiddleware() runs    |
       |                              |  on EVERY request:         |
       |                              |  - Verifies JWT signature  |
       |                              |  - Checks expiration       |
       |                              |  - Extracts clerkUserId    |
       |                              |                            |
       |                              |  requireAuth() middleware: |
       |                              |  - Looks up user in local  |
       |                              |    PostgreSQL DB            |
       |                              |  - Checks status = active  |
       |                              |  - Checks role if needed   |
       |                              |                            |
       |   200 OK / 401 / 403        |                            |
       |<-----------------------------+                            |


  Other Service (e.g. Question Svc)          User Service
  =====================================      ============
       |                                          |
       | Receives client request with JWT         |
       | Does NOT validate JWT itself             |
       |                                          |
       | GET /users/internal/authz/context        |
       | Headers:                                 |
       |   Authorization: Bearer <client JWT>     |
       |   x-internal-service-key: <shared key>   |
       +----------------------------------------->|
       |                                          | Validates both:
       |                                          | 1. Internal API key
       |                                          | 2. Client JWT via Clerk
       |   { clerkUserId, role, status }          |
       |<-----------------------------------------+
       |                                          |
       | Checks role == "admin" locally           |
       | Proceeds or rejects                      |
```

The JWT itself only carries the `clerkUserId`. All user metadata (role, status, name) is stored in the local PostgreSQL database, not in the JWT claims. This means role changes take effect immediately without waiting for token refresh.

#### User Bootstrap (First Login)

When a user signs in for the first time, the frontend calls `GET /users/me`. The `requireAuth` middleware is configured with `allowMissingLocalUser: true` for this route, so it allows the request even when no local DB record exists. The service then:

1. Fetches the full Clerk profile (name, email, avatar, preferred language)
2. Performs an `INSERT ... ON CONFLICT DO UPDATE` (upsert) to create the local user record
3. The new user gets `role = 'user'` and `status = 'active'` by default

On subsequent logins, the same upsert updates the user's name, avatar, and last login time.

#### Clerk Webhooks

Clerk sends webhook events when user accounts change. The webhook route is mounted **before** `express.json()` because Svix signature verification requires the raw request body.

```
  Clerk                    User Service                    PostgreSQL
  =====                    ============                    ==========
    |                           |                              |
    | POST /users/webhooks/clerk|                              |
    | Headers:                  |                              |
    |   svix-id, svix-timestamp,|                              |
    |   svix-signature          |                              |
    +-------------------------->|                              |
    |                           |                              |
    |                  1. Verify Svix signature                |
    |                     using CLERK_WEBHOOK_SIGNING_SECRET   |
    |                     (reject if invalid)                  |
    |                           |                              |
    |                  2. Route by event type:                 |
    |                           |                              |
    |   user.created  --------->| INSERT user                  |
    |                           +----------------------------->|
    |                           |                              |
    |   user.updated  --------->| UPDATE user (conditional:    |
    |                           | only overwrites avatar and   |
    |                           | language if present in       |
    |                           | webhook payload)             |
    |                           +----------------------------->|
    |                           |                              |
    |   user.deleted  --------->| SET status = 'deleted'       |
    |                           +----------------------------->|
    |                           |                              |
    |           200 OK          |                              |
    |<--------------------------+                              |
```

#### Roles and Access Control

| Role         | Permissions                                          | Assignment                                       |
| ------------ | ---------------------------------------------------- | ------------------------------------------------ |
| `user`       | Access own profile, join matchmaking, collaborate    | Default on sign-up                               |
| `admin`      | All user permissions + manage users and questions    | Promoted by super_user or another admin          |
| `super_user` | All admin permissions, cannot be modified or deleted | Seeded during migration via `CLERK_SUPERUSER_ID` |

The `super_user` role acts as a safeguard -- exactly one super_user exists, seeded at migration time. They cannot be deleted, suspended, or have their role changed through the API.

When an admin **suspends** a user, the service also calls `clerkClient.users.banUser()` and revokes all active Clerk sessions, immediately locking the user out. Unsuspending calls `clerkClient.users.unbanUser()`.

#### Account Deletion

When a user deletes their account via `DELETE /users/me`:

1. Verifies the user is not the `super_user` (rejects with 403)
2. Deletes the user from **Clerk** first (`clerkClient.users.deleteUser()`)
3. Soft-deletes locally by setting `status = 'deleted'`

#### Database Schema

```
  users
  +---------------------+---------------+----------------------------------------+
  | Column              | Type          | Notes                                  |
  +---------------------+---------------+----------------------------------------+
  | clerk_user_id (PK)  | TEXT          | Clerk's external user ID               |
  | name                | TEXT NOT NULL | Display name                           |
  | avatar_url          | TEXT          | Profile image URL                      |
  | status              | TEXT          | 'active' | 'suspended' | 'deleted'     |
  | role                | TEXT          | 'user' | 'admin' | 'super_user'        |
  | score               | INTEGER >= 0  | Proficiency score (default 0)          |
  | preferred_language  | TEXT          | Default coding language                |
  | last_login_at       | TIMESTAMPTZ   | Last sign-in time                      |
  | created_at          | TIMESTAMPTZ   | Auto-set on creation                   |
  | updated_at          | TIMESTAMPTZ   | Auto-set on modification               |
  +---------------------+---------------+----------------------------------------+

  admin_audit_logs
  +---------------------+---------------+----------------------------------------+
  | Column              | Type          | Notes                                  |
  +---------------------+---------------+----------------------------------------+
  | id (PK)             | UUID          | Auto-generated                         |
  | actor_user_id (FK)  | TEXT          | Admin who performed the action         |
  | action              | TEXT          | PROMOTE / DEMOTE / SUSPEND / UNSUSPEND |
  | target_user_id (FK) | TEXT          | User affected                          |
  | metadata            | JSONB         | Old/new role or status values          |
  | created_at          | TIMESTAMPTZ   | When the action occurred               |
  +---------------------+---------------+----------------------------------------+
```

---

### 2. Matching Service

Pairs users in real-time based on selected topics, difficulties, and programming languages. Uses WebSockets for bidirectional communication and Redis with atomic Lua scripts for concurrency-safe matchmaking. Matching is a **two-phase notification** -- users are told immediately when a match is found (`match_preparing`), then again when the collaboration workspace is ready (`match_success`).

#### Tech Stack

- **Runtime:** Node.js / TypeScript
- **Framework:** Express 5
- **Communication:** Socket.IO (WebSockets)
- **State Management:** Redis (with embedded Lua scripting)
- **Inter-service Messaging:** RabbitMQ
- **Validation:** Zod

#### Redis Data Models

All matchmaking state is centralized in Redis (no in-process memory) so that multiple Matching Service instances can be run behind a load balancer.

**Queue Sorted Sets** (`mm:q:{topic}:{difficulty}:{language}`)

- Type: Sorted Set (ZSET)
- Score: Entry timestamp (ms) for FIFO ordering
- Member: Seeker's Redis key (`mm:us:{userId}`)

**Seeker Hash** (`mm:us:{userId}`)

- Type: Hash (HSET)

| Field        | Type           | Description                                              |
| ------------ | -------------- | -------------------------------------------------------- |
| `status`     | String         | `READY` or `DISCONNECTED`                                |
| `last_seen`  | Timestamp (ms) | Last time status was updated                             |
| `start_time` | Timestamp (ms) | Original queue entry time (preserved across re-enqueues) |
| `queues`     | JSON array     | Queue keys this user is currently in                     |
| `score`      | Number         | User's skill score for range-based matching              |

A single user can be a member of **multiple queues simultaneously** (one per topic/difficulty/language combination selected in the matchmaking form).

#### Socket Events -- Complete Reference

**Client -> Server:**

| Event          | Payload                                                                       | Description                                        |
| -------------- | ----------------------------------------------------------------------------- | -------------------------------------------------- |
| `join_queue`   | `{ topics[], difficulties[], languages[], userScore, scoreRange, isUpdate? }` | Enter matchmaking (validated by Zod)               |
| `cancel_queue` | --                                                                            | Leave all matchmaking queues                       |
| `disconnect`   | --                                                                            | Built-in Socket.IO event (tab close, network loss) |

**Server -> Client:**

| Event             | Payload                                                                       | Description                                                           |
| ----------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `match_waiting`   | `{ matchFound: false, startTime }`                                            | User is queued, searching for a partner                               |
| `match_preparing` | `{ matchFound: true, matchId, partnerId, topic, difficulty, language }`       | Match found, workspace being created (immediate)                      |
| `match_success`   | `{ matchFound: true, collaborationId, matchId, topic, difficulty, language }` | Workspace ready, navigate to collaboration page (async, via RabbitMQ) |
| `match_cancelled` | --                                                                            | Queue exit confirmed                                                  |
| `match_error`     | `{ message }`                                                                 | Validation failure, cancel failure, or unexpected error               |

#### Request Validation (Zod)

Every `join_queue` event is validated at the boundary:

```
  MatchDetailsSchema:
  {
    topics:       string[]           min(1, "Select at least one topic")
    difficulties: ("Easy"|"Medium"|"Hard")[]   min(1)
    languages:    string[]           min(1, "Select at least one language")
    userScore:    non-negative int
    scoreRange:   non-negative int
    isUpdate?:    boolean            (optional, for relaxation re-submits)
  }
```

If validation fails, `match_error` is emitted immediately and the request is dropped.

#### Atomic Matchmaking via Lua Scripts

All Redis state mutations happen inside **four Lua scripts** executed atomically, preventing race conditions when multiple users join or disconnect concurrently.

```
                      Lua Script Overview
                      ====================

  +------------------+   +-------------------+
  |  FIND_MATCH      |   |  ATTEMPT_REJOIN   |
  |                  |   |                   |
  | Search queues    |   | Check if user can |
  | for compatible   |   | resume existing   |
  | partner, or      |   | queue position    |
  | enqueue seeker   |   | after reconnect   |
  +------------------+   +-------------------+

  +------------------+   +-------------------+
  |  DISCONNECT      |   |  CANCEL_MATCH     |
  |                  |   |                   |
  | Mark user as     |   | Remove user from  |
  | DISCONNECTED,    |   | ALL queues and    |
  | start grace      |   | delete their hash |
  | period           |   | (explicit cancel) |
  +------------------+   +-------------------+
```

#### FIND_MATCH -- Step by Step

This is the core algorithm, executed every time `join_queue` is received:

```
                      FIND_MATCH Lua Script
                      =====================

  Input: queue keys[], seeker status key, timestamp,
         numQueues, seekerScore, seekerRange

  1. PRESERVE START TIME
     +-- If seeker already has a Redis hash:
     |   Read existing start_time
     |   If DISCONNECTED and past grace period: reset start_time
     |   Remove seeker from all current queues (clean slate)
     |
  2. SEARCH FOR MATCH
     +-- For each queue (topic:difficulty:language):
     |   Fetch up to 50 candidates (sorted by timestamp, FIFO)
     |   For each candidate (skip self):
     |   +-- No status? Remove stale entry, skip
     |   +-- DISCONNECTED + past 5s grace? Clean up entirely, skip
     |   +-- READY + |seekerScore - candScore| <= seekerRange?
     |       +-----------------------------------------------+
     |       | MATCH FOUND                                   |
     |       | Remove BOTH users from ALL their queues       |
     |       | Return ['matched', partnerId, topic,          |
     |       |          difficulty, language, startTime]      |
     |       +-----------------------------------------------+
     |
  3. NO MATCH -- ENQUEUE
     +-- ZADD seeker to every queue (score = timestamp)
     +-- HSET seeker hash: status=READY, queues, score, etc.
     +-- Return ['enqueued', '', '', '', '', startTime]
```

**Score-based matching:** A candidate matches only if the absolute difference between their scores is within the seeker's `scoreRange`. This is the mechanism that enables relaxation -- by increasing `scoreRange` over time, more candidates become eligible.

**Lazy cleanup:** Disconnected users whose grace period expired are not cleaned up by a background job. Instead, they are cleaned up opportunistically when the next FIND_MATCH encounters them as candidates.

#### Two-Phase Match Notification

```
                  Phase 1: match_preparing          Phase 2: match_success
                  (immediate, synchronous)          (async, via RabbitMQ)
                  ========================          ======================

  join_queue                                     Collaboration Service
  triggers                                       creates session
  FIND_MATCH                                     and responds
      |                                               |
      v                                               v
  Lua returns                                    RabbitMQ consumer
  "matched"                                      receives response
      |                                               |
      +---> Generate matchId (UUID)                   +---> Parse collaborationId
      +---> Publish to RabbitMQ REQ_QUEUE             +---> Emit match_success
      +---> Emit match_preparing                            to BOTH users
            to BOTH users                                   |
            |                                               v
            v                                          Frontend navigates
       Frontend shows                                  to /collaboration/:id
       "preparing session..."
       (no collaborationId yet)

  Timeline:
  |--- match_preparing ---|--- 1-3 seconds ---|--- match_success ---|
       (instant)              (RabbitMQ +              (async)
                              session creation)
```

The `match_preparing` payload includes `partnerId` so the frontend can show who the match is with. The `match_success` payload adds the `collaborationId` so the frontend can navigate to the collaboration workspace.

#### Client-Driven Score Relaxation

The score range is widened by the **client**, not by a server-side timer:

```
Client (Frontend)                         Server (Matching Service)
  ================                         ========================
      |                                        |
      | T=0s: join_queue {range: 50,           |
      |   diff: ["Easy"], isUpdate: false}     |
      +--------------------------------------->| 1. attemptRejoin (guard)
      |                                        | 2. FIND_MATCH (Exact, "Easy")
      |        match_waiting                   |
      |<---------------------------------------+
      |                                        |
      | (12s: Tier 1 - Expand Range)           |
      |                                        |
      | join_queue {range: 100,                |
      |   diff: ["Easy"], isUpdate: true}      |
      +--------------------------------------->| 3. FIND_MATCH (±100, "Easy")
      |<---------------------------------------+
      |                                        |
      | (24s: Tier 2 - Expand Range)           |
      |                                        |
      | join_queue {range: 200,                |
      |   diff: ["Easy"], isUpdate: true}      |
      +--------------------------------------->| 4. FIND_MATCH (±200, "Easy")
      |<---------------------------------------+
      |                                        |
      | (36s: Tier 3 - Adjacent Difficulty)    |
      |                                        |
      | join_queue {range: 300,                |
      |   diff: ["Easy", "Medium"], isUpd: T}  |
      +--------------------------------------->| 5. FIND_MATCH (±300, "Easy"|"Med")
      |<---------------------------------------+
      |                                        |
      | (48s: Tier 4 - Full Relaxation)        |
      |                                        |
      | join_queue {range: 400,                |
      |   diff: ["E", "M", "H"], isUpd: T}     |
      +--------------------------------------->| 6. FIND_MATCH (±400, Any Diff)
      |<---------------------------------------+
      |                                        |
      | (60s: Max Timeout)                     |
      |                                        |
      |          cancelSearch()                | (Cleanup Redis & inform user)
      +--------------------------------------->|

  - isUpdate: false --> attemptRejoin runs first (prevent duplicate entry)
  - isUpdate: true  --> skip attemptRejoin, go straight to FIND_MATCH
  - start_time is preserved across re-enqueues (timer continuity)
```

#### Multi-Tab Handling

Multiple browser tabs for the same user are handled without duplicate queue entries:

```
                       Multi-Tab Scenario
                       ===================

  Tab 1 (already queued)          Server           Tab 2 (new tab opened)
  ======================          ======           ======================
        |                           |                        |
        | (already in queue,        |    WebSocket connect   |
        |  status: READY)           |<-----------------------+
        |                           |                        |
        |                           | socket.join(userId)    |
        |                           | attemptRejoin(userId)  |
        |                           |                        |
        |                           | Lua: status=READY,     |
        |                           | return {success,       |
        |                           |        startTime}      |
        |                           |                        |
        |   match_waiting           |    match_waiting       |
        |   (via io.to(userId))     |    (via io.to(userId)) |
        |<--------------------------+----------------------->|
        |                           |                        |
        |   Both tabs are now       |                        |
        |   synced to the same      |                        |
        |   queue state and timer   |                        |

  On disconnect:
  - Tab 1 closes: fetchSockets() returns [Tab 2] -> do nothing
  - Tab 2 closes: fetchSockets() returns [] -> run DISCONNECT Lua
```

- On connection, every socket joins a room named after the `userId`. All emits use `io.to(userId)`, so every tab receives the same events.
- When `join_queue` arrives with `isUpdate: false`, `attemptRejoin` runs first. If the user is already `READY`, it returns success and emits `match_waiting` instead of re-running FIND_MATCH, preventing duplicate queue entries.
- On disconnect, `fetchSockets()` checks if other tabs remain. `handleDisconnect` only runs when the **last** tab closes.

#### Disconnection Handling

```
                      Disconnection State Machine
                      ============================

                             join_queue or
                             new connection
            +----------+    (attemptRejoin)     +--------------+
            |          |<-----------------------|              |
    join -->|  READY   |                        | DISCONNECTED |
            |          |----------------------->|              |
            +----+-----+   last tab closes      +------+-------+
                 |          (DISCONNECT Lua:            |
                 |           status=DISCONNECTED,       |
                 |           last_seen=now)              |
                 |                                      |
                 |  cancelMatch                  5s grace period expires
                 |  (explicit cancel)            (lazy cleanup by next
                 v                                FIND_MATCH that
            +---------+                           encounters this user)
            | REMOVED |                                 |
            | (hash   |                                 v
            |  deleted)|                          +-----------+
            +---------+                           |  REMOVED  |
                                                  |  (cleaned |
                                                  |   up)     |
                                                  +-----------+

  Grace period: 5 seconds (hardcoded in Lua scripts)

  During grace period:
  - User stays in queue sorted sets (not removed)
  - FIND_MATCH skips DISCONNECTED users (only matches READY)
  - attemptRejoin flips status back to READY if within 5s
  - After 5s: attemptRejoin returns 'fail', FIND_MATCH cleans up
```

**If a user disconnects after `match_preparing` but before `match_success`:**
The FIND_MATCH Lua script already removed both users from all queues and deleted their hashes. The DISCONNECT script checks if the key exists first -- if gone, it does nothing. The RabbitMQ consumer will still emit `match_success` to the userId room. If no sockets are connected, the event is lost. The user would need to check with the Collaboration Service directly on reconnection.

#### RabbitMQ Integration

```
  Matching Service                    RabbitMQ                 Collaboration Service
  ================                    ========                 =====================

  PUBLISHING (on match found):
  +---------------------------+
  | collab_create_req_queue   |-----> Consumed by Collab Svc
  | (durable)                 |
  | Message:                  |
  |   { matchId, userAId,    |
  |     userBId, difficulty,  |
  |     language, topic }     |
  |   persistent: true        |
  +---------------------------+

  CONSUMING (session created):
  +---------------------------+
  | collab_create_res_queue   |<----- Published by Collab Svc
  | (durable, prefetch: 1)   |
  | Message:                  |
  |   { session: {            |
  |       collaborationId,    |
  |       userAId, userBId,   |
  |       ... },              |
  |     idempotentHit }       |
  +---------------------------+
        |
        v
  Parse response, emit match_success to both users

  Error handling:
  - Malformed JSON: ack and discard (poison message)
  - Retryable error: re-publish with x-retry-count+1 (max 5)
  - Max retries exceeded: nack without requeue (dead-letter)
  - Connection lost: auto-reconnect after 5 seconds
```

#### Authentication

Socket connections are authenticated via the User Service before any events are processed:

1. Extract JWT from `Authorization` header or `socket.handshake.auth.token`
2. Forward to User Service at `GET /users/internal/authz/context` with the JWT and `x-internal-service-key`
3. Reject if: no token, User Service returns non-OK, or `status !== "active"`
4. Store `socket.data.userId` and `socket.data.role` for use in handlers

---

### 3. Question Service

Provides CRUD operations for coding questions and topics. Supports LeetCode question import for content management. Serves as the question bank for the entire platform, with internal endpoints consumed by the Collaboration Service during session creation.

#### Tech Stack

- **Runtime:** Node.js / TypeScript
- **Framework:** Express 5
- **Database:** Google Cloud SQL (PostgreSQL) in production, local PostgreSQL 16 in development
- **ORM:** None -- raw SQL via `pg` library for lightweight, direct database access

#### Dual-Database Architecture

The Question Service is designed to run against **two different database backends** depending on the environment:

```
                   Question Service Database Architecture
                   ======================================

  +---------------------+                +-------------------------+
  |    LOCAL DEV        |                |      PRODUCTION         |
  |                     |                |                         |
  |  docker-compose.yml |                |  .env (default config)  |
  |  overrides DB_HOST  |                |  DB_HOST=cloudsql-proxy |
  |  to "questions-db"  |                |  DB_USER=cs3219         |
  |                     |                |                         |
  |  +---------------+  |                |  +-------------------+  |
  |  | PostgreSQL 16 |  |                |  | Cloud SQL Proxy   |  |
  |  | (Alpine)      |  |                |  | (sidecar)         |  |
  |  | questions-db  |  |                |  +--------+----------+  |
  |  | :5432         |  |                |           |             |
  |  +---------------+  |                |  +--------v----------+  |
  +---------------------+                |  | Google Cloud SQL  |  |
                                         |  | (Managed PG)      |  |
                                         |  | Project:          |  |
                                         |  | cs3219-491608     |  |
                                         |  +-------------------+  |
                                         +-------------------------+

  Why Cloud SQL for production?
  - Managed backups, patching, and high availability
  - Accessible across GKE/Cloud Run without exposing public IP
  - Cloud SQL Proxy handles authentication via service accounts
```

In local development, Docker Compose overrides `DB_HOST=questions-db` to point at a local PostgreSQL container. In production, the service connects through the Cloud SQL Auth Proxy sidecar (`DB_HOST=cloudsql-proxy`) to a managed Google Cloud SQL instance.

#### Database Schema

```
  questions                                    topics
  +---------------------+-----------+          +-------+----------+
  | quid (PK)           | UUID      |          | tid   | UUID (PK)|
  | title               | TEXT      |          | topic | TEXT     |
  | description         | TEXT      |          +-------+----------+
  | difficulty          | TEXT      |
  | topics              | UUID[]    |---+      qn_topics (join table)
  | image               | TEXT      |   |      +-------+----------+
  | test_case           | JSON      |   |      | quid  | UUID (FK)|----> questions
  | popularity_score    | INTEGER   |   |      | tid   | UUID (FK)|----> topics
  | function_name       | TEXT      |   +----->| difficulty | TEXT |
  +---------------------+-----------+          +-------+----------+
                                               Composite PK: (quid, tid)
                                               Index: (tid, difficulty)
```

**Design choice:** Topics are stored both as a UUID array on the `questions` table (for fast reads) and in the `qn_topics` join table (for indexed queries by topic + difficulty). The join table has a composite index on `(tid, difficulty)` to optimize question selection during matchmaking.

**Test cases** are stored as a JSON array on each question:

```json
[
  { "input": [[1, 3, -1, -3, 5, 3, 6, 7], 3], "output": [3, 3, 5, 5, 6, 7] },
  { "input": [{ "val": 2, "left": { "val": 1 } }, 1], "output": true }
]
```

The `function_name` field (e.g., `"twoSum"`, `"isValidBST"`) tells the Execution Service which function to invoke when running user code against test cases.

#### API Routes

| Method   | Endpoint           | Auth     | Description                                 |
| -------- | ------------------ | -------- | ------------------------------------------- |
| `GET`    | `/`                | Public   | List all questions                          |
| `GET`    | `/popular`         | Public   | Get popular questions (by score)            |
| `POST`   | `/get`             | Public   | Get a single question by ID                 |
| `POST`   | `/search`          | Public   | Search by topic + difficulty                |
| `GET`    | `/topics`          | Public   | List all topics                             |
| `POST`   | `/`                | Admin    | Create a question                           |
| `PUT`    | `/`                | Admin    | Edit a question                             |
| `DELETE` | `/:id`             | Admin    | Delete a question                           |
| `POST`   | `/leetcode`        | Admin    | Fetch questions from LeetCode GraphQL API   |
| `POST`   | `/topics`          | Admin    | Create a topic                              |
| `PUT`    | `/topics`          | Admin    | Edit a topic                                |
| `DELETE` | `/topics/:id`      | Admin    | Delete a topic                              |
| `POST`   | `/internal/select` | Internal | Select a random question for a match        |
| `POST`   | `/internal/get`    | Internal | Get full question details (with test cases) |

#### Question Selection for Matchmaking

When the Collaboration Service creates a session, it calls `POST /internal/select` to pick a question. The selection algorithm:

```
  Collaboration Service              Question Service              PostgreSQL
  =====================              ================              ==========
        |                                  |                           |
        | POST /internal/select            |                           |
        | { topic, difficulty,             |                           |
        |   userAId, userBId }             |                           |
        +--------------------------------->|                           |
        |                                  |                           |
        |                         1. Query qn_topics JOIN topics       |
        |                            WHERE topic = :topic              |
        |                            AND difficulty = :difficulty       |
        |                                  +-------------------------->|
        |                                  |   [matching question IDs] |
        |                                  |<--------------------------+
        |                                  |                           |
        |                         2. Pick one at RANDOM                |
        |                            Math.random() from results        |
        |                                  |                           |
        |                         3. Fetch full question record        |
        |                                  +-------------------------->|
        |                                  |<--------------------------+
        |                                  |                           |
        | { questionId, title,             |                           |
        |   topic, difficulty }            |                           |
        |<---------------------------------+                           |
```

#### LeetCode Import

Admins can fetch question metadata from LeetCode's public GraphQL API (`POST /leetcode`). This queries `https://leetcode.com/graphql/` with a tag filter and returns metadata (title, difficulty, acceptance rate, topic tags). The admin can then manually create questions based on this data.

#### Admin Authorization (Delegated)

The Question Service does **not** validate JWTs itself. Admin routes use a `requireAdminAuth` middleware that delegates to the User Service:

1. Forwards the client's `Authorization` header to `GET /users/internal/authz/context`
2. Adds the `x-internal-service-key` for service-to-service trust
3. Checks the returned `role` is `admin` or `super_user` and `status` is `active`

Internal routes (`/internal/*`) are mounted **before** the admin middleware in the route chain, ensuring they are only gated by the `x-internal-service-key` check and not by JWT validation.

---

### 4. Collaboration Service

Real-time collaborative coding session manager. Pairs two matched users into a shared code editor backed by Operational Transformation (OT), handles code execution and submission via RabbitMQ, and provides AI-powered hints via Google Gemini.

**Port:** 3003 | **State:** All in Redis (no database) | **Real-time:** Socket.IO with Redis adapter

#### Tech Stack

- **Runtime:** Node.js / TypeScript
- **Framework:** Express 4, Socket.IO 4 with Redis adapter
- **State:** Redis (sessions, OT documents, presence, output, hints, Socket.IO pub/sub)
- **Messaging:** RabbitMQ (session creation + code execution)
- **Concurrency:** Redis Lua scripts for atomic compare-and-swap

#### Internal Dependencies

All inter-service HTTP calls use `x-internal-service-key` header auth and native `fetch` -- no calls go through the API gateway.

| Dependency | URL | Purpose |
|---|---|---|
| User Service | `http://user-service:3001` | Socket auth (validates JWT via `/users/internal/authz/context`), user name resolution |
| Question Service | `http://questions-service:3005` | Question selection (`/internal/select`) and details + test cases (`/internal/get`) |
| Execution Service | via RabbitMQ `exec_req_queue` / `exec_res_queue` | Sandboxed code execution (not direct HTTP) |
| Attempt Service | `http://attempts-service:3004` | Records attempts directly via `POST /attempts` |
| Gemini API | `https://generativelanguage.googleapis.com` | AI hint generation (Gemini 2.5 Flash) |
| Redis | | All session state + Socket.IO cross-instance pub/sub |
| RabbitMQ | | Session creation requests from matching + code execution request/response |

#### Session Creation

Sessions are created via **two paths**, both calling the same `createSession` logic:

1. **RabbitMQ consumer** (primary) -- Consumes from `collab_create_req_queue` (published by matching service). On success, publishes result to `collab_create_res_queue`. Failures retry with exponential backoff (2s, 4s, 8s, 16s, 32s) via a delay queue with dead-letter routing. Non-retryable errors (user invalid, question not found, active session conflict) are discarded immediately.

2. **HTTP endpoint** -- `POST /sessions` with internal service auth. Returns the session directly.

Creation steps: validate both users (User Service) -> select question (Question Service) -> create session in Redis -> initialize OT document with language-specific code template (e.g., `class Solution { twoSum() {} }`). Duplicate requests with the same matchId return the existing session (idempotent).

#### Socket Authentication

Sockets authenticate on connection via middleware. The client sends a JWT (in `Authorization` header or `auth.token`). The middleware forwards it to the User Service's `/users/internal/authz/context` endpoint. If the user is active, `socket.data.userId` is set; otherwise the connection is rejected.

#### Session Join

On `session:join` with a `collaborationId`, the server:

1. Validates session exists, is active, and user is assigned to it
2. Checks user hasn't left, and if disconnected, that they're within the 30s reconnect grace period
3. Registers the socket (supports multiple tabs per user)
4. Returns full state: session metadata, question details, code snapshot + OT revision, participant presence, existing hints, user display names
5. Broadcasts `user:joined` and `presence:updated` to the room

#### Real-Time Code Editing (OT)

Uses **Operational Transformation** to synchronize edits between two users:

- Clients send `code:change` with their revision number and operations (`insert` / `delete` / `retain`)
- Server transforms incoming ops against concurrent ops since the client's revision
- Atomic updates via a **Redis Lua CAS script** (check `currentRevision == expected` before writing), with up to 5 retries on conflict
- Acknowledged ops are broadcast to all other clients in the room
- On unrecoverable desync, a full `code:sync` is sent with the authoritative document

```
  CONFLICT CASE: Both clients edit at the same time
  ==================================================

  Client A (rev 5)              Server (rev 5)             Client B (rev 5)
       |                              |                              |
       | insert "X" at pos 0          |          insert "Y" at pos 3 |
       +----------------------------->|<-----------------------------+
       |                              |                              |
       |     A arrives first: rev matches, apply directly            |
       |     doc = "X...", server rev = 6                            |
       |                              |                              |
       |     B arrives second: rev 5 < server 6                     |
       |     Fetch ops since rev 5, transform B against A:           |
       |     B's insert at pos 3 shifts to pos 4                     |
       |     Apply transformed ops, CAS update -> rev 7              |
       |                              |                              |
       |   Broadcast transformed ops  |     ACK {revision: 7}       |
       |<-----------------------------+----------------------------->|
```

Operation history is capped at 50 entries. Server uses `priority: "right"` (existing server ops take precedence at same position).

#### Presence & Disconnection

```
  User Presence State Machine (with multi-tab)
  ==============================================

  Each tab = 1 Socket.IO connection. Redis tracks socketCount per user.
  State transitions depend on whether sockets remain open.

                        session:join
                        (any tab)
                            |
                            v
                    +---------------+
                    |   CONNECTED   |  socketCount >= 1
                    |               |  (each new tab increments count)
                    +-------+-------+
                      ^     |     |
                      |     |     |  user clicks "Leave" on a tab:
          tab opens   |     |     |  - that socket is removed
         (new socket  |     |     |  - if socketCount > 0: still CONNECTED
          joins room) |     |     |  - if socketCount == 0: transitions to LEFT
                      |     |     |
                      |     |     +---------------------------+
                      |     |                                 |
                      |     |  tab closes / network drop:     |
                      |     |  - that socket is removed        |
                      |     |  - if socketCount > 0:           |
                      |     |    still CONNECTED (no event)    |
                      |     |  - if socketCount == 0:          |
                      |     |    transitions to DISCONNECTED   |
                      |     |                                 |
                      |     v                                 v
                +---------------+                     +-----------+
                | DISCONNECTED  |                     |   LEFT    |
                | socketCount=0 |                     | permanent |
                +-------+-------+                     +-----+-----+
                  ^     |                                   |
                  |     |  rejoin within 30s                |
                  |     |  (new tab connects):              |
                  |     |  -> back to CONNECTED             |
                  |     |                                   |
                  |     |  grace period expires:            |
                  |     |  -> cannot rejoin                 |
                  |     v                                   |
                  |  +-------------+                        |
                  |  | Cannot      |                        |
                  |  | rejoin      |                        |
                  |  +-------------+                        |
                  |                                         |
                  +----- if other user is also              |
                         LEFT or DISCONNECTED: -------------+
                                    |
                                    v
                              +-----------+
                              |SESSION END|
                              +-----------+
```

| Aspect | DISCONNECTED | LEFT |
|---|---|---|
| Trigger | Network drop, tab close, ping timeout | User clicks "Leave Session" |
| Rejoin? | Yes (within 30s grace period) | No (permanent) |
| Active session index | Kept (user sees rejoin prompt) | Cleared |
| Other user sees | `user:disconnected` | `user:left` |
| Session ends? | No (stays active) | Yes, if partner is LEFT or DISCONNECTED |

**Multi-tab synchronization:** Each browser tab opens a separate Socket.IO connection. All sockets for the same user in the same session share presence state in Redis. OT operations, execution results, and hints are broadcast to the Socket.IO room, so every tab receives them. A user is only marked `DISCONNECTED` when **all** their sockets close (socketCount reaches 0). `session:leave` only removes the triggering socket -- the user is only marked `LEFT` when their last socket triggers it. This means closing one tab doesn't disrupt the session if other tabs remain open.

**Startup orphan cleanup:** On boot, the service scans Redis for `socket:*` keys left by a previous crash, removes them, and marks any users still appearing as "connected" to "disconnected".

#### Code Execution: Run vs Submit

Both `code:run` and `code:submit` publish an `ExecutionRequestMessage` to `exec_req_queue` (RabbitMQ). A Redis key `exec:pending:<correlationId>` with 65s TTL acts as a timeout safety net. When the execution service responds on `exec_res_queue`:

- Results are stored in Redis and broadcast to the room via `output:updated`
- **Run:** no attempt recorded -- done
- **Submit:** additionally records the attempt directly to the Attempt Service (`POST http://attempts-service:3004/attempts`) and sends `submission:complete` to the submitting user only

Key design decisions:
- Either user can submit independently (no dual-agreement needed)
- Execution results are shared with **both** users
- Attempt is attributed **only** to the user who clicked Submit
- Success = all test cases passed (`testCasesPassed == totalTestCases > 0`)

#### AI Hints

Integrates with **Google Gemini 2.5 Flash** for context-aware hints. Each user gets **2 hints per session** (4 total for the pair), shared with both participants in real time.

Flow: validate session & rate limit (atomic Redis `INCR`) -> fetch current code + question context -> call Gemini (maxOutputTokens: 512, temperature: 0.4) -> store hint in Redis -> broadcast `hint:updated` to room.

The prompt has two modes: if code exists, it analyzes for bugs/missing logic; if no code, it suggests algorithms/data structures. It never provides full solutions -- only 2-3 sentence guidance. Previous hints are included to avoid repetition.

#### Session End

Sessions end via: **both users left**, **inactivity timeout** (30min, checked every 60s with a Redis distributed lock for horizontal scaling), or **manual** `endSession` call. On end: session marked inactive, user active-session indices cleared, all Redis data cleaned up (session, presence, OT doc, output, hints), `session:ended` emitted.

#### Socket Events Reference

**Client -> Server:**

| Event | Payload | Description |
|---|---|---|
| `session:check-active` | -- | Check if user has a session to rejoin |
| `session:join` | `{ collaborationId }` | Join room; returns full state |
| `code:change` | `{ collaborationId, revision, operations[] }` | Send OT operations |
| `session:leave` | `{ collaborationId }` | Intentionally leave (permanent) |
| `code:run` | `{ collaborationId }` | Run code (no attempt) |
| `code:submit` | `{ collaborationId }` | Submit code (run + record attempt) |
| `hint:request` | `{ collaborationId }` | Request AI hint |

**Server -> Client:**

| Event | Scope | Description |
|---|---|---|
| `connection:ready` | Sender | Auth confirmed, includes `userId` |
| `user:joined` | Room (excl. sender) | User joined/reconnected |
| `presence:updated` | Room (all) | Updated participant list |
| `code:change` | Room (excl. sender) | Broadcast OT operations |
| `code:sync` | Sender | Full doc sync (recovery fallback) |
| `user:disconnected` | Room (all) | User's last connection dropped |
| `user:left` | Room (all) | User intentionally left |
| `session:ended` | Room (all) | Session terminated (with reason) |
| `code:running` | Room (all) | Execution in progress |
| `output:updated` | Room (all) | Execution results |
| `submission:complete` | Submitter only | Attempt recorded with results |
| `hint:updated` | Room (all) | New AI hint available |

#### Configuration

| Setting | Default | Env Variable |
|---|---|---|
| Session TTL | 1 hour | `CS_SESSION_TTL_MS` |
| Disconnect grace | 30 seconds | `CS_DISCONNECT_GRACE_MS` |
| Inactivity timeout | 30 minutes | `CS_SESSION_INACTIVITY_TIMEOUT_MS` |
| Heartbeat interval | 25 seconds | `CS_HEARTBEAT_INTERVAL_MS` |
| Heartbeat timeout | 20 seconds | `CS_HEARTBEAT_TIMEOUT_MS` |
| Max hints per user | 2 | Constant |
| OT history cap | 50 ops | Constant |
| OT CAS retries | 5 | Constant |

#### Horizontal Scaling

- **Socket.IO Redis adapter** for cross-instance event broadcast
- **OT Lua CAS** for race-free concurrent writes
- **Redis distributed lock** (`SET NX PX`) for inactivity sweeper -- only one instance runs the check
- **Nginx `ip_hash`** for consistent Socket.IO routing

---

### 5. Execution Service

A sandboxed code execution adapter that wraps the [Piston](https://github.com/engineer-man/piston) engine. It receives user code and test cases from the Collaboration Service, wraps the code in a **language-specific test harness**, runs everything in a single Piston process, and returns per-test-case results.

#### Tech Stack

- **Runtime:** Node.js / TypeScript
- **Framework:** Express 4
- **Execution Engine:** Piston (self-hosted, sandboxed)
- **Auth:** Shared `x-internal-service-key` (internal-only service)

#### Supported Languages

| Language   | Piston Runtime | Version |
| ---------- | -------------- | ------- |
| Python     | `python`       | 3.10.0  |
| JavaScript | `node`         | 18.15.0 |
| TypeScript | `typescript`   | 5.0.3   |
| Java       | `java`         | 15.0.2  |

Runtimes are **auto-installed** on first startup. The service retries connecting to Piston up to 15 times (3s apart, ~45s total), then fires concurrent install requests for any missing runtimes (10-minute timeout each). The HTTP server is available immediately while runtimes install in the background.

#### API

| Method | Endpoint   | Auth     | Description                     |
| ------ | ---------- | -------- | ------------------------------- |
| `POST` | `/execute` | Internal | Execute code against test cases |
| `GET`  | `/health`  | None     | Health check                    |

**Request payload:**

```
{
  code: string           // User's source code
  language: string       // "python" | "javascript" | "typescript" | "java"
  functionName: string   // Function to invoke (e.g., "twoSum")
  testCases: [           // Non-empty array
    { input: any, output: any }   // input = args, output = expected
  ]
}
```

**Response payload:**

```
{
  results: [
    { testCaseIndex, passed, actualOutput, expectedOutput, error?, executionTimeMs }
  ],
  totalTestCases: number,
  testCasesPassed: number,
  stderr: string
}
```

#### How Code Execution Works

The service generates a **self-contained source file** by wrapping user code in a test harness, sends test cases as stdin JSON, and parses structured results from stdout:

```
                    Code Execution Pipeline
                    =======================

  Collaboration Service                Execution Service                   Piston
  =====================                =================                   ======
        |                                     |                              |
        | POST /execute                       |                              |
        | {code, language,                    |                              |
        |  functionName, testCases}           |                              |
        +------------------------------------>|                              |
        |                                     |                              |
        |                            1. Generate combined source:            |
        |                               User code + test harness            |
        |                                     |                              |
        |                            2. Serialize testCases as              |
        |                               JSON for stdin                      |
        |                                     |                              |
        |                            3. POST /api/v2/execute                |
        |                               {language, files: [source],         |
        |                                stdin: testCasesJson,              |
        |                                run_timeout, memory_limit}         |
        |                                     +----------------------------->|
        |                                     |                              |
        |                                     |    Piston runs code in       |
        |                                     |    sandboxed container       |
        |                                     |                              |
        |                                     |    Harness reads stdin,      |
        |                                     |    calls fn per test case,   |
        |                                     |    prints JSON to stdout     |
        |                                     |                              |
        |                                     |    {stdout, stderr, code}    |
        |                                     |<----------------------------+
        |                                     |                              |
        |                            4. Parse stdout JSON                   |
        |                            5. Compare each actual vs expected     |
        |                               (normalized JSON string match)      |
        |                                     |                              |
        |   {results[], testCasesPassed,      |                              |
        |    totalTestCases, stderr}           |                              |
        |<------------------------------------+                              |
```

#### Language-Specific Test Harness

Each language gets a wrapper that resolves the user's function, iterates over test cases, and outputs structured JSON:

```
                    Test Harness Pattern (all languages)
                    ====================================

  +---------------------------+
  |  User's source code       |  <-- Inserted verbatim
  |  (e.g., class Solution)   |
  +---------------------------+
  |  Test harness code:       |
  |                           |
  |  1. Resolve function:     |
  |     - Try global fn name  |
  |     - Try Solution().fn   |  <-- Supports LeetCode-style classes
  |                           |
  |  2. Read stdin (JSON)     |
  |     Parse as testCases[]  |
  |                           |
  |  3. For each test case:   |
  |     - Splat input as args |
  |     - Call function        |
  |     - Catch exceptions    |
  |     - Record {output,     |
  |              error}        |
  |                           |
  |  4. Print JSON results    |
  |     to stdout             |
  +---------------------------+

  Function resolution order:
  - Python:     globals() -> Solution().method
  - JavaScript: typeof fn -> new Solution().method.bind()
  - TypeScript: typeof fn -> new Solution().method.bind()
  - Java:       Always Solution class, method found via reflection
```

**All test cases run in a single process** -- there is no per-test-case isolation. If the code crashes on test case 3, test cases 4+ produce no results (reported as "No result for this test case").

#### Error Detection

The service detects and reports several categories of failure:

| Failure               | How Detected                                         | Reported As                                        |
| --------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| Compilation error     | `compile.code !== 0`                                 | `"Compilation error: <stderr>"` for all test cases |
| Time limit exceeded   | `run.signal === "SIGKILL"` and no "memory" in stderr | `"Time limit exceeded"` for all test cases         |
| Memory limit exceeded | `run.signal === "SIGKILL"` and "memory" in stderr    | `"Memory limit exceeded"` for all test cases       |
| Runtime exception     | Per-test-case `error` in harness output              | Error message from the exception                   |
| Function not found    | Harness resolution fails                             | `"Method <name> not found"` or reference error     |
| Unparseable output    | stdout is not valid JSON                             | `stderr` or `"Runtime error"` for all test cases   |

#### Sandbox Limits

| Parameter          | Default    | Configurable              |
| ------------------ | ---------- | ------------------------- |
| Run timeout        | 10 seconds | `PISTON_RUN_TIMEOUT`      |
| Memory limit       | 128 MB     | `PISTON_RUN_MEMORY_LIMIT` |
| Compile timeout    | 15 seconds | Hardcoded                 |
| Request body limit | 1 MB       | Hardcoded                 |
| Max output         | 64 KB      | Piston container env      |
| Networking         | Disabled   | Piston container env      |

---

### 6. Attempt Service

Records and retrieves user coding attempt history. Called internally by the Collaboration Service when a user submits code, and exposes a user-facing endpoint for viewing past attempts. Integrates with the User Service to **update proficiency scores** based on attempt outcomes.

#### Tech Stack

- **Runtime:** Node.js / TypeScript
- **Framework:** Express 4
- **Database:** PostgreSQL 16
- **Logging:** Pino

#### API Routes

| Method | Endpoint                        | Auth       | Description                                       |
| ------ | ------------------------------- | ---------- | ------------------------------------------------- |
| `GET`  | `/attempts/me`                  | User (JWT) | Get current user's attempt history (newest first) |
| `POST` | `/attempts/`                    | Internal   | Record a new attempt + update user score          |
| `GET`  | `/attempts/users/:id/questions` | Internal   | List distinct question IDs attempted by a user    |

#### How Attempts Are Recorded

When a user clicks "Submit" in the collaboration workspace, the Collaboration Service calls `POST /attempts/` with the attempt details:

```
  Collaboration Service                  Attempt Service                User Service
  =====================                  ===============                ============
        |                                      |                            |
        | POST /attempts                       |                            |
        | x-internal-service-key: <key>        |                            |
        | {                                    |                            |
        |   userId, collaborationId,           |                            |
        |   questionId, questionTitle,         |                            |
        |   language, difficulty,              |                            |
        |   success, duration,                 |                            |
        |   totalTestCases, testCasesPassed    |                            |
        | }                                    |                            |
        +------------------------------------->|                            |
        |                                      |                            |
        |                             1. Validate all fields               |
        |                             2. Check for existing attempt        |
        |                                with same (userId, collabId)      |
        |                                                                  |
        |                             IF DUPLICATE (re-submit):            |
        |                               Calculate old score delta          |
        |                               Delete old attempt row             |
        |                               netDelta = newDelta - oldDelta     |
        |                             ELSE (first submit):                 |
        |                               netDelta = newDelta                |
        |                                      |                            |
        |                             3. Insert new attempt row            |
        |                                      |                            |
        |                             4. Apply score delta                  |
        |                                POST /users/internal/deltas       |
        |                                      +--------------------------->|
        |                                      |  {previousScore, newScore} |
        |                                      |<---------------------------+
        |                                      |                            |
        |                             5. If score update fails:            |
        |                                DELETE the inserted attempt        |
        |                                (compensation / rollback)          |
        |                                      |                            |
        |   201 { attempt, scoreUpdates }      |                            |
        |<-------------------------------------+                            |
```

#### Score Calculation

The service calculates a **proficiency score delta** for each attempt based on difficulty and outcome:

```
  Score Delta Table
  =================
  +------------+---------+--------+
  | Difficulty | Success | Delta  |
  +------------+---------+--------+
  | Easy       | Pass    |  +10   |
  | Medium     | Pass    |  +30   |
  | Hard       | Pass    |  +50   |
  | Any        | Fail    |  -10   |
  +------------+---------+--------+

  Score is always >= 0 (clamped by User Service).

  On re-submit (same user + collaborationId):
  - Old attempt is deleted
  - Net delta = new delta - old delta
  - Example: first submit failed (-10), re-submit passes Hard (+50)
             net delta = +50 - (-10) = +60
```

The score update is sent to the User Service via `POST /users/internal/deltas`, which applies it transactionally with row-level locking (`SELECT FOR UPDATE`) and `GREATEST(0, score + delta)` to prevent negative scores.

If the score update call fails (User Service down, timeout, etc.), the **inserted attempt row is deleted** as compensation -- ensuring the database and score stay consistent.

#### Idempotent Re-Submission

The `attempts` table has a **partial unique index** on `(clerk_user_id, collaboration_id) WHERE collaboration_id IS NOT NULL`. This means a user can only have one attempt per collaboration session. When a user re-submits:

1. The existing attempt for that `(userId, collaborationId)` is found
2. The old score delta is reversed
3. The old row is deleted
4. A new attempt is inserted with the updated results
5. The net score delta is applied

This allows users to improve their score within a session by fixing bugs and re-submitting.

#### Database Schema

```
  attempts
  +---------------------+------------------+---------------------------------------+
  | Column              | Type             | Notes                                 |
  +---------------------+------------------+---------------------------------------+
  | id (PK)             | UUID             | Generated per attempt                 |
  | clerk_user_id       | TEXT NOT NULL     | Indexed                               |
  | question_id         | TEXT NOT NULL     | Indexed                               |
  | question_title      | TEXT NOT NULL     | Human-readable title                  |
  | collaboration_id    | TEXT             | Nullable (partial unique with user)   |
  | language            | TEXT NOT NULL     | Programming language used             |
  | difficulty          | TEXT NOT NULL     | CHECK: Easy, Medium, Hard             |
  | success             | BOOLEAN NOT NULL  | All test cases passed?                |
  | duration            | DOUBLE PRECISION  | Seconds since session start, >= 0     |
  | total_test_cases    | INTEGER NOT NULL  | Total test cases in the question      |
  | test_cases_passed   | INTEGER NOT NULL  | How many passed                       |
  | attempted_at        | TIMESTAMPTZ       | When the attempt was made             |
  | created_at          | TIMESTAMPTZ       | Row creation time                     |
  +---------------------+------------------+---------------------------------------+

  Indexes:
  - idx_attempts_clerk_user_id        ON (clerk_user_id)
  - idx_attempts_question_id          ON (question_id)
  - idx_attempts_attempted_at         ON (attempted_at DESC)
  - idx_attempts_user_collaboration   UNIQUE ON (clerk_user_id, collaboration_id)
                                      WHERE collaboration_id IS NOT NULL
```

#### Attempt History Retrieval

`GET /attempts/me` authenticates the user via their JWT (delegated to User Service), then returns all attempts ordered by `attempted_at DESC, created_at DESC` (most recent first). There is no pagination -- all attempts are returned in a single response.

---

## Inter-Service Flows & Integrations

### End-to-End User Journey

This is the complete flow from login to completing a coding session:

```
                           Full User Journey
                           =================

  1. SIGN IN
     User --> Clerk (OAuth/Email) --> JWT issued --> Frontend stores token

  2. BROWSE QUESTIONS
     Frontend --[GET /v1/api/qs/]--> Gateway --> Question Service --> PostgreSQL

  3. JOIN MATCHMAKING
     Frontend --[WebSocket + JWT]--> Gateway --> Matching Service
       --> Redis (atomic Lua: enqueue or match)
       --> If matched: publish to RabbitMQ REQ_QUEUE

  4. SESSION CREATED
     RabbitMQ --> Collaboration Service
       --> Question Service (select question)
       --> Redis (create session)
       --> RabbitMQ RES_QUEUE --> Matching Service
       --> Emit match_success to both clients

  5. COLLABORATIVE CODING
     Frontend --[WebSocket]--> Gateway --> Collaboration Service
       --> OT sync between both clients via Redis
       --> Code execution: Collaboration Svc --> Execution Svc --> Piston

  6. SESSION END
     Collaboration Service
       --> Attempt Service (record attempt in PostgreSQL)
       --> Redis (cleanup session)
```

### RabbitMQ Message Flow

```
                      RabbitMQ Queue Architecture
                      ===========================

  +------------------+       REQ_QUEUE        +---------------------+
  |                  | =====================> |                     |
  | Matching Service |   CreateSession msg    | Collaboration Svc   |
  |                  |   {userA, userB,       |                     |
  |                  |    matchId, config}    |  1. Consume message |
  |                  |                        |  2. Select question |
  |                  |       RES_QUEUE        |  3. Create session  |
  |                  | <===================== |  4. Publish result  |
  |                  |   SessionCreated msg   |                     |
  +------------------+   {sessionId, status}  +---------------------+

  - Queues are durable (survive broker restarts)
  - Messages include x-retry-count header (max 5 retries)
  - Non-retryable errors are discriminated and dead-lettered
```

## CI/CD Pipeline

GitHub Actions workflows run on every push and pull request to `main`:

### Backend (`backend.yml`)

- **Node.js 24**
- Runs lint + tests for:
  - User Service
  - Matching Service
  - Question Service (lint only)
  - Collaboration Service
  - Attempt Service

### Frontend (`frontend.yml`)

- **Node.js 25**
- Runs lint checks

### Code Quality

- **Linting:** ESLint
- **Formatting:** Prettier
- **Testing:** Vitest (unit and integration tests)

---

## Tech Stack Summary

| Category | Technologies |
|----------|-------------|
| **Language** | TypeScript (entire stack) |
| **Runtime** | Node.js 24 |
| **Frontend** | React 19, Vite 7, TailwindCSS, Radix UI, shadcn/ui |
| **Backend** | Express 4/5, Socket.IO |
| **Databases** | PostgreSQL 16 (x3), Redis (x2) |
| **Message Broker** | RabbitMQ 4.2 |
| **Auth** | Clerk (JWT-based) |
| **AI Hints** | Google Gemini 2.5 Flash |
| **Code Execution** | Piston (sandboxed) |
| **API Gateway** | Nginx |
| **Containerization** | Docker, Docker Compose (17 containers) |
| **CI/CD** | GitHub Actions |
| **Logging** | Pino |
| **Validation** | Zod |
| **Testing** | Vitest |

---

## Declaration of Use of AI Tools

This project made use of AI-assisted tooling during development. The following outlines the scope and boundaries of AI usage.

### AI Use Summary

**Tools:** GitHub Copilot, OpenAI Codex (ChatGPT), Claude Code (Anthropic)

**Prohibited phases avoided:** Requirements elicitation; architecture/design decisions.

**Allowed uses:**
- **Generate:** Boilerplate for Express middleware, test scaffolding (Vitest), Redis command syntax in Lua scripts, language-specific code harness templates, and documentation (README).
- **Refactor:** Suggested inline code improvements for data parsing, error handling utilities, and frontend component splitting. Suggestions were reviewed and selectively retained.
- **Debug:** Copilot PR review comments flagged missing null checks, unused imports, and inconsistent error handling across pull requests.
- **Explain:** Used to understand Clerk webhook signature verification and Piston API response formats.

**How each tool was used:**

| Tool | Mode | Scope |
|------|------|-------|
| GitHub Copilot | Generate, Refactor, Debug | Inline autocomplete for boilerplate code, CSS utility classes, test case structures. Automated first-layer PR reviewer on all pull requests (see [closed PRs](https://github.com/CS3219-AY2526S2/peerprep-g02/pulls?q=is%3Apr+is%3Aclosed)). Team members always conduct a manual review after Copilot. |
| OpenAI Codex (ChatGPT) | Generate, Refactor | Frontend component splitting, test harness generation, implementation-level code snippets. |
| Claude Code (Anthropic) | Generate, Explain | Documentation and README generation, code exploration, Lua syntax assistance. |

**What AI was NOT used for:**
- Architecture/design decisions -- all system design choices (microservices decomposition, communication patterns, database selection, OT strategy, message queue topology, network isolation, distributed locking) were made by the team
- Core algorithm design -- matchmaking logic, operational transformation, session lifecycle state machines, and scoring systems were designed and implemented by team members
- Requirements elicitation -- all feature requirements were derived from the project brief and team discussions

**Verification:** All AI outputs were reviewed, edited, and tested by the authors. No AI-generated code was accepted as-is; every suggestion was modified to fit the project's patterns and verified through testing.

**Prompts & Key Exchanges:** See [`/ai/usage-log.md`](ai/usage-log.md) for the full timestamped log of AI interactions, prompts, outputs, and author notes on modifications.
