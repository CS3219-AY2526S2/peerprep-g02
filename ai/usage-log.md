# AI Usage Log

## Note on GitHub Copilot for PR Reviews

GitHub Copilot is enabled as a **first-layer reviewer** on all pull requests in this repository. When a PR is opened, Copilot automatically reviews the changes and leaves comments on potential issues, style inconsistencies, and suggestions. After Copilot's review, team members then conduct a **manual review** before approving and merging. This two-layer process helps catch surface-level issues early so human reviewers can focus on logic, architecture, and design decisions.

For evidence of this workflow, see our closed pull requests: [https://github.com/CS3219-AY2526S2/peerprep-g02/pulls?q=is%3Apr+is%3Aclosed](https://github.com/CS3219-AY2526S2/peerprep-g02/pulls?q=is%3Apr+is%3Aclosed)

---

## Entry 1

**Date/Time:** 2026-02-25 14:30

**Tool:** GitHub Copilot

**Prompt/Command:** Autocomplete suggestions while writing Redis Lua scripts for matchmaking queue operations in the Matching Service.

**Output Summary:** Copilot suggested key patterns for ZSET operations (`ZADD`, `ZREM`, `ZRANGE`) and boilerplate for reading hash fields in Lua syntax. Also suggested the `remove_from_all_queues` helper function structure.

**Action Taken:**
- [x] Modified

**Author Notes:** Used Copilot's Lua syntax suggestions as a starting point but rewrote the atomic matching logic, grace period handling, and score range comparison. The FIND_MATCH algorithm and the FIFO-with-score-gating design were my own. Verified correctness by running unit tests with mock Redis and manually testing concurrent join/cancel scenarios.

---

## Entry 2

**Date/Time:** 2026-03-17 10:15

**Tool:** GitHub Copilot

**Prompt/Command:** Inline suggestions while writing the Operational Transformation (OT) transform function for the Collaboration Service (`otService.ts`).

**Output Summary:** Copilot autocompleted some of the position-shifting arithmetic for insert-vs-insert and insert-vs-delete cases. Suggested the basic structure for the `transformOperation` switch cases.

**Action Taken:**
- [x] Modified

**Author Notes:** The transform logic required careful handling of edge cases (overlapping deletes, same-position inserts with priority). Copilot's suggestions were a useful scaffold but I had to correct the boundary conditions and add the retain-type fallback for fully overlapping deletes. Verified by writing test cases with concurrent conflicting edits and comparing against the expected transformed output.

---

## Entry 3

**Date/Time:** 2026-03-05 16:45

**Tool:** GitHub Copilot

**Prompt/Command:** Autocomplete suggestions while writing unit tests for the Collaboration Service session creation and presence tracking logic.

**Output Summary:** Suggested test case structures for `vitest`, mock setup patterns for Redis client stubs, and assertion boilerplate for checking session state after join/leave/disconnect operations.

**Action Taken:**
- [x] Modified

**Author Notes:** Used Copilot's test scaffolding as a starting point but added test cases for edge scenarios it did not cover: concurrent join from two sockets (multi-tab), rejoin after grace period expiry, and idempotent session creation with duplicate matchIds. Also replaced the basic mocks with proper `vi.spyOn` patterns to verify Redis call sequences. All tests pass and cover the critical session lifecycle paths.

---

## Entry 4

**Date/Time:** 2026-03-24 11:20

**Tool:** GitHub Copilot

**Prompt/Command:** Autocomplete while writing the Redis Lua compare-and-swap (CAS) script for atomic OT document updates in `redisOTRepository.ts`.

**Output Summary:** Suggested the basic `redis.call('GET', key)` and conditional `SET` pattern for optimistic locking.

**Action Taken:**
- [x] Modified

**Author Notes:** Extended the suggestion to include revision number tracking, capped operation history (`LPUSH` + `LTRIM`), and the retry loop in the calling TypeScript code (up to 5 retries with re-transform). The atomic CAS ensures no lost updates when two users edit simultaneously. Tested by simulating rapid concurrent edits from two clients.

---

## Entry 5

**Date/Time:** 2026-03-11 09:00

**Tool:** GitHub Copilot

**Prompt/Command:** PR review comments via Copilot on pull request for the Matching Service WebSocket handlers.

**Output Summary:** Flagged a missing null check on `socket.data.userId` after auth middleware, suggested adding `.bind()` to event handler callbacks, and recommended extracting magic strings into constants.

**Action Taken:**
- [x] Modified

**Author Notes:** Accepted the null check suggestion and the constants extraction. Rejected the `.bind()` suggestion as we use arrow functions. Added the `SOCKET_EVENTS` constants object based on the recommendation.

---

## Entry 6

**Date/Time:** 2026-03-26 14:00

**Tool:** GitHub Copilot

**Prompt/Command:** Inline autocomplete while writing the `canRejoinWithinGracePeriod()` method in `redisPresenceRepository.ts` for checking disconnect duration against the configured grace period.

**Output Summary:** Suggested the timestamp arithmetic (`now - lastDisconnectTime`) and the conditional return pattern for allowed/denied rejoin.

**Action Taken:**
- [x] Modified

**Author Notes:** The arithmetic was straightforward but I added handling for the three presence states (CONNECTED returns allowed, LEFT returns permanently denied, DISCONNECTED does the time check). Also added the descriptive error message that includes the actual disconnect duration and the grace period limit, which helps with debugging. Verified by writing a test that mocks `Date.now()` to simulate both within and past the grace window.

---

## Entry 7

**Date/Time:** 2026-03-09 20:30

**Tool:** GitHub Copilot

**Prompt/Command:** Autocomplete while writing the `requireAdminAuth` middleware for the Question Service.

**Output Summary:** Suggested the fetch call to the User Service internal auth endpoint and the basic role-checking logic.

**Action Taken:**
- [x] Modified

**Author Notes:** The fetch pattern was standard but I added proper error handling for network failures, status code forwarding from the User Service, and the `super_user` role equivalence check. Also ensured the middleware stores the auth context in `res.locals` for downstream handlers.

---

## Entry 8

**Date/Time:** 2026-04-01 13:15

**Tool:** OpenAI Codex (ChatGPT)

**Prompt/Command:** "Refactor the collaboration session frontend from a single monolithic view into smaller, reusable components. The current CollaborationSessionView.tsx is over 400 lines and handles the code editor, output panel, question display, participants, and session controls all in one file."

**Output Summary:** Suggested splitting into separate components: a code editor panel, an output/results panel, a question description panel, a participant presence bar, and session control buttons (leave, run, submit). Provided prop interfaces and a parent layout using CSS grid.

**Action Taken:**
- [x] Modified

**Author Notes:** Adopted the component decomposition but redesigned the layout to use our existing shadcn/ui `ResizablePanel` components instead of raw CSS grid. Wrote the `AiHintsPanel` component from scratch as it was not in the AI suggestion. Integrated the OT client hook (`useCollaborationSession`) at the parent level and passed state down via props rather than using the context pattern the AI suggested. Kept the Socket.IO event listeners in the hook rather than scattering them across child components. Verified by testing all collaboration flows end-to-end: join, edit, run, submit, leave, and disconnection recovery.

---

## Entry 9

**Date/Time:** 2026-04-03 17:00

**Tool:** GitHub Copilot

**Prompt/Command:** Auto-fix suggestions on linting errors across multiple services after upgrading ESLint config.

**Output Summary:** Suggested fixes for import ordering, unused variable removal, consistent quote style, and trailing comma additions across ~40 files.

**Action Taken:**
- [x] Modified

**Author Notes:** Accepted most auto-fixes as they were purely stylistic. Rejected a few that removed variables that were actually used in type-only imports. Verified by running the full lint suite after applying changes.

---

## Entry 10

**Date/Time:** 2026-04-07 10:45

**Tool:** Claude Code (Anthropic)

**Prompt/Command:** "Generate language-specific test harness wrappers for the Execution Service that wrap user code, read test cases from stdin, call the user's function, and output JSON results."

**Output Summary:** Produced initial Python, JavaScript, and TypeScript harness templates with stdin reading, JSON parsing, function invocation, and structured JSON output.

**Action Taken:**
- [x] Modified

**Author Notes:** Rewrote the function resolution logic to support both standalone functions and LeetCode-style `class Solution` patterns (checking globals first, then Solution class). Added proper argument splatting for multi-argument functions. Wrote the Java harness separately using reflection as the AI-generated version did not handle Java's type system correctly. Verified by running all four languages against the seeded question test cases.

---

## Entry 11

**Date/Time:** 2026-03-13 15:30

**Tool:** GitHub Copilot

**Prompt/Command:** Autocomplete while writing the `calculateScoreDelta` function in the Attempt Service.

**Output Summary:** Suggested the switch-case structure for difficulty-based scoring (Easy/Medium/Hard) and the fail penalty constant.

**Action Taken:**
- [x] Modified

**Author Notes:** Adjusted the delta values to match our team's agreed scoring model (+10/+30/+50 for success, -10 for failure). Added the re-submission compensation logic (net delta = new - old) which was not part of the suggestion. Wrote unit tests to verify all difficulty/success combinations and the re-submit overwrite case.

---

## Entry 12

**Date/Time:** 2026-03-18 11:00

**Tool:** GitHub Copilot

**Prompt/Command:** Autocomplete while writing the Express error handling and response helper utilities for the Collaboration Service (`utils/errors.ts`, `middleware/errorHandler.ts`).

**Output Summary:** Suggested the `AppError` class extending `Error` with a `statusCode` property, and the Express error middleware pattern that checks for `AppError` instances and falls back to 500 for unexpected errors.

**Action Taken:**
- [x] Modified

**Author Notes:** Extended the error class with an `errorCode` string field (e.g., `HINT_LIMIT_REACHED`, `REJOIN_GRACE_PERIOD_EXPIRED`) for machine-readable error identification in socket ack responses. Added structured logging of errors via pino with context fields (collaborationId, userId) for traceability. The Copilot suggestion only covered basic HTTP error middleware -- our service needed error handling for both REST and Socket.IO paths.

---

## Entry 13

**Date/Time:** 2026-04-10 19:00

**Tool:** Claude Code (Anthropic)

**Prompt/Command:** "Write the README.md for the PeerPrep project with architecture diagrams covering all 6 microservices, communication patterns, and deployment setup."

**Output Summary:** Generated a comprehensive README with ASCII architecture diagrams, service documentation sections, socket event tables, flow diagrams for OT synchronization, matchmaking, session lifecycle, and authentication.

**Action Taken:**
- [x] Modified

**Author Notes:** Reviewed all diagrams and descriptions against the actual codebase. Corrected several details: added the Cloud SQL production database setup for the Question Service, expanded the Collaboration Service section with accurate OT conflict resolution details, and added the AI Hints feature which was missing. Restructured the document ordering and table of contents to match our team's preferred layout.

---

## Entry 14

**Date/Time:** 2026-02-23 16:00

**Tool:** GitHub Copilot

**Prompt/Command:** Autocomplete while writing the Matching Service Lua scripts for queue operations (`matchmaking.ts`).

**Output Summary:** Suggested boilerplate for iterating over Redis sorted sets with `ZRANGE`, basic `HGET`/`HSET` patterns, and JSON encoding/decoding within Lua (`cjson.encode`, `cjson.decode`).

**Action Taken:**
- [x] Modified

**Author Notes:** Used the Redis command patterns but designed the multi-queue search strategy, score-range matching logic, and the lazy cleanup of expired disconnected users myself. The `remove_from_all_queues` helper and the grace period expiry check within FIND_MATCH were written from scratch. Tested each script individually with `redis-cli EVAL` before integrating.

---

## Entry 15

**Date/Time:** 2026-03-31 11:30

**Tool:** Claude Code (Anthropic)

**Prompt/Command:** "Help me write the docker-compose.yml for the Matching Service, including Redis and the connection to the shared RabbitMQ and gateway network."

**Output Summary:** Generated a docker-compose service block with Redis dependency, environment variable mapping, network assignments, and health check conditions for RabbitMQ.

**Action Taken:**
- [x] Modified

**Author Notes:** Adjusted the network topology to use our isolated `matching-redis-network` (Redis should not be on the gateway network), added the `rabbitmq-network` attachment, and configured the `depends_on` with `service_healthy` condition for RabbitMQ. Also added the GCP secrets volume mount. The AI had everything on a single flat network which would have violated our isolation design.

---

## Entry 16

**Date/Time:** 2026-03-20 14:20

**Tool:** OpenAI Codex (ChatGPT)

**Prompt/Command:** "Refactor the matching frontend from a single MatchingView.tsx into separate components for the form, searching state, and rejoin prompt."

**Output Summary:** Suggested splitting into `MatchFormView.tsx`, `MatchSearchingView.tsx`, and `RejoinSessionView.tsx` with a parent `MatchingView.tsx` orchestrating state transitions between them. Provided component prop interfaces and basic JSX structure.

**Action Taken:**
- [x] Modified

**Author Notes:** Used the component split as proposed but rewrote the state management to use our `useMatchingQueue` hook instead of local state. Redesigned the MatchFormView to use our shadcn/ui multi-select components for topics, difficulties, and languages. The RejoinSessionView was written from scratch as the AI version did not account for the `session:check-active` socket event flow. Verified transitions by testing all paths: fresh queue, match found, cancel, disconnect/rejoin, and active session detection.

---

## Entry 17

**Date/Time:** 2026-03-22 09:45

**Tool:** GitHub Copilot

**Prompt/Command:** Inline suggestions while styling the matching views with TailwindCSS classes.

**Output Summary:** Suggested Tailwind utility classes for the searching animation (pulse, spin), card layouts, responsive grid, and button variants. Also suggested the timer display formatting.

**Action Taken:**
- [x] Modified

**Author Notes:** Accepted most of the layout utility classes but customised the color scheme to use our violet/indigo palette and match the rest of the app. Replaced the suggested spinner with a custom Lucide icon animation. Adjusted responsive breakpoints to work within the home page layout context rather than as standalone pages.

---

## Entry 18

**Date/Time:** 2026-04-11 20:00

**Tool:** Claude Code (Anthropic)

**Prompt/Command:** "Write the Matching Service section of the README with detailed diagrams for the Lua matchmaking algorithm, two-phase notification flow, disconnection handling, and multi-tab support."

**Output Summary:** Generated the full Matching Service documentation with ASCII diagrams for FIND_MATCH step-by-step logic, match_preparing vs match_success timeline, disconnection state machine, client-driven relaxation flow, and multi-tab scenario.

**Action Taken:**
- [x] Modified

**Author Notes:** Verified all diagrams against the actual Lua script logic and socket handler code. Corrected the grace period value (5 seconds, not 10 as initially generated). Added the Zod validation schema details and the complete socket event reference table. Removed a section about GCP Pub/Sub that described it as active when it is only scaffolded.

---

## Entry 19

**Date/Time:** 2026-02-18 13:00

**Tool:** GitHub Copilot

**Prompt/Command:** Autocomplete while writing the User Service Clerk integration middleware (`requireAuth.ts`).

**Output Summary:** Suggested the `getAuth(req)` call from `@clerk/express` and the basic pattern for extracting `userId` from the verified JWT context. Also suggested the 401/403 response structure.

**Action Taken:**
- [x] Modified

**Author Notes:** Extended the middleware significantly beyond the suggestion: added the `allowMissingLocalUser` option for the bootstrap flow, the `requiredRole` parameter for role-based access control, and the `super_user` satisfying `admin` role logic. The Copilot suggestion only handled the basic auth-or-reject case. Tested with Clerk's development mode tokens.

---

## Entry 20

**Date/Time:** 2026-03-04 10:30

**Tool:** OpenAI Codex (ChatGPT)

**Prompt/Command:** "Help me implement the Clerk webhook handler for user lifecycle events (user.created, user.updated, user.deleted) with Svix signature verification."

**Output Summary:** Provided the webhook route setup with `express.raw()` body parsing, the `verifyWebhook()` call from `@clerk/express/webhooks`, and a switch-case handler for the three event types.

**Action Taken:**
- [x] Modified

**Author Notes:** The key insight the AI missed was that the webhook route must be mounted before `express.json()` middleware, otherwise the raw body is consumed and signature verification fails. Fixed the route ordering in `app.ts`. Also added conditional field updates for `user.updated` (only overwrite avatar and language if present in the payload) to prevent accidental null overwrites. Verified by triggering test webhooks from the Clerk dashboard.

---

## Entry 21

**Date/Time:** 2026-02-20 15:00

**Tool:** GitHub Copilot

**Prompt/Command:** Autocomplete while writing the User Service database migration files and the migration runner.

**Output Summary:** Suggested the `CREATE TABLE` SQL with standard column types and the basic migration runner pattern (read `.sql` files, execute in order).

**Action Taken:**
- [x] Modified

**Author Notes:** Added the `admin_audit_logs` table with foreign keys and the JSONB metadata column for tracking role/status changes. Added the super_user seeding logic (insert from `CLERK_SUPERUSER_ID` env var if not exists, enforce exactly one). Wrapped each migration in a transaction with rollback on error. The AI did not suggest audit logging or the super_user invariant.

---

## Entry 22

**Date/Time:** 2026-03-16 16:30

**Tool:** GitHub Copilot

**Prompt/Command:** Inline suggestions while writing the admin user management routes (list users, update role, update status).

**Output Summary:** Suggested the CRUD route structure, Clerk batch user fetching for emails, and the `banUser`/`unbanUser` Clerk API calls for suspension sync.

**Action Taken:**
- [x] Modified

**Author Notes:** Added the audit logging to `admin_audit_logs` on every role or status change, the super_user protection checks (cannot modify or delete), and the session revocation on suspension. Chunked the Clerk email fetch to batches of 100 to avoid rate limits. Copilot's version had no audit trail and no protection against modifying the super_user account.

---

## Entry 23

**Date/Time:** 2026-04-11 10:00

**Tool:** Claude Code (Anthropic)

**Prompt/Command:** "Write the User Service section of the README with diagrams for the JWT auth flow, webhook handling, bootstrap flow, and role management."

**Output Summary:** Generated the User Service documentation with ASCII diagrams for JWT validation delegation, Clerk webhook event routing, the user bootstrap upsert pattern, and the database schema.

**Action Taken:**
- [x] Modified

**Author Notes:** Reviewed against the actual middleware and controller code. Added the internal auth context endpoint diagram showing how other services delegate JWT validation to the User Service. Corrected the account deletion flow to clarify that Clerk deletion happens first (not transactional with the local soft-delete). Added the admin audit logs table to the schema section.

---

## Entry 24

**Date/Time:** 2026-04-02 14:00

**Tool:** Claude Code (Anthropic)

**Prompt/Command:** "Help me write the root docker-compose.yml to orchestrate all microservices, databases, Redis instances, RabbitMQ, and the Nginx API gateway with proper network isolation."

**Output Summary:** Generated a docker-compose file with service definitions for all containers, volume mounts, environment variable mappings, port bindings, and a single shared network.

**Action Taken:**
- [x] Modified

**Author Notes:** The AI put everything on one flat network. Redesigned the network topology into 7 isolated bridge networks (gateway-network, user-db-network, matching-redis-network, questions-db-network, collaboration-redis-network, attempts-db-network, rabbitmq-network) so that each database is only accessible by its owning service. Added health checks with `service_healthy` conditions for PostgreSQL and RabbitMQ `depends_on` blocks. Added the ngrok and dozzle containers which the AI did not include. Configured `ip_hash` sticky sessions for the Collaboration Service upstream in the Nginx config to support Socket.IO. Verified by running `docker-compose up` and confirming containers could only reach their intended dependencies.

---

## Entry 25

**Date/Time:** 2026-04-10 18:00

**Tool:** Claude Code (Anthropic)

**Prompt/Command:** "Write a comprehensive README.md for the PeerPrep project covering all 6 microservices, system architecture, inter-service communication, authentication, and deployment."

**Output Summary:** Generated a full README with ASCII architecture diagrams, service communication maps, Docker network topology, per-service documentation with API route tables, and flow diagrams for matchmaking, OT synchronization, session lifecycle, and authentication.

**Action Taken:**
- [x] Modified

**Author Notes:** Reviewed every diagram and description against the actual codebase. Key corrections made: added the Google Cloud SQL dual-database setup for the Question Service, expanded the Collaboration Service with accurate OT conflict resolution and disconnection state machine details, added the AI Hints feature documentation, corrected the Matching Service grace period from 10s to 5s, removed a Pub/Sub section that described a scaffolded-but-unimplemented feature as active, added the Attempt Service score calculation and idempotent re-submission logic, and added the Execution Service test harness wrapping details. Restructured the document to move Team Members and Authentication Architecture higher per team preference.