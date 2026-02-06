# Production Logging & Observability Plan

## Context

Launch10 has three production gaps: (1) a P0 bug where failed edits silently report success to users, (2) 239 unstructured console.log/warn/error calls across 52 files with no log levels, correlation, or structure, and (3) no cross-service request tracing between Rails and Langgraph. The goal is a startup-appropriate observability stack that gives us structured logs, error visibility, and cross-service correlation without enterprise costs.

---

## Phase 1: Fix P0 + Remove Debug Noise

**No new dependencies. Ship immediately.**

### 1.1 Fix silent error swallowing in singleShotEdit.ts

**File:** `app/nodes/coding/singleShotEdit.ts` (lines 187-209)

The current code collects errors but always returns `status: "completed"` with the LLM's optimistic text. Fix:

- Count successful vs failed edits
- When **ALL** edits fail: replace the user-facing message with a vague error ("I attempted to make the changes but encountered errors applying the edits. Could you try rephrasing your request?")
- When **SOME** edits fail: append a note to the LLM's text ("Note: some edits could not be applied. You may want to verify the changes.")
- Report to Rollbar for all failures (user-impacting)
- Keep `status: "completed"` — the graph node did complete its work; the issue is the message content

### 1.2 Delete debug dump in agent.ts

**File:** `app/nodes/coding/agent.ts` line 127

Delete: `console.log("finalSystemPrompt", finalSystemPrompt);` — dumps 10K+ chars on every full-agent invocation.

### 1.3 Delete debug spam in brainstorm/agent.ts

**File:** `app/nodes/brainstorm/agent.ts`

- Delete lines 157-162 (6x `console.log("running agent....")`)
- Delete line 176 (`console.log(\`result: ${JSON.stringify(result, null, 2)}\`)`) — dumps entire brainstorm result

### 1.4 Clean up crude error logger

**File:** `app/core/errors/index.ts` lines 5-10

Replace `console.log("ERROR!!!")` / `console.log(e)` with `console.error("[Launch10 Error]", e)` as a stopgap (Phase 2 replaces this with Pino).

---

## Phase 2: Structured Logging Foundation

### 2.1 Install Pino

```bash
pnpm add pino
pnpm add -D pino-pretty
```

### 2.2 Create logger module

**New file:** `app/core/logger/index.ts`

- Root Pino logger singleton
- Development: `pino-pretty` transport (colorized, human-readable)
- Production: plain JSON to stdout (for log drain ingestion)
- Test: `level: "silent"`
- Redact sensitive fields: `jwt`, `authorization`, `token`
- Base bindings: `{ service: "langgraph", env: NODE_ENV }`

**New file:** `app/core/logger/context.ts`

- AsyncLocalStorage for `LoggerContext` containing `{ requestId, logger (Pino child) }`
- `getLogger(bindings?)` — returns the context-bound child logger (if in ALS scope) or root logger (fallback), with additional bindings merged
- Also reads `getNodeContext()` to auto-attach `nodeName` and `graphName`

### 2.3 AsyncLocalStorage propagation strategy

Create a `loggingMiddleware` using `createStorageMiddleware`:

```typescript
export const loggingMiddleware = createStorageMiddleware<any, LoggerContext>({
  name: "logging",
  storage: loggerStorage,
  createContext(ctx) {
    return {
      requestId: ctx.requestId ?? randomUUID(),
      logger: rootLogger.child({
        requestId: ctx.requestId,
        threadId: ctx.threadId,
        graphName: ctx.graphName,
      }),
    };
  },
});
```

**File:** `app/api/middleware/appBridge.ts` — add `loggingMiddleware` alongside `usageTrackingMiddleware`

### 2.4 Add Hono request logging middleware

**New file:** `app/server/middleware/requestLogger.ts`

- Generate or accept `X-Request-Id` from incoming headers
- Set `X-Request-Id` response header
- Log `{ requestId, method, path }` on request start
- Log `{ requestId, status, durationMs }` on completion
- Store `requestId` on Hono context (`c.set("requestId", id)`) for graph config

**File:** `server.ts` — replace `app.use("*", logger())` with `app.use("*", requestLogger)`

### 2.5 Export from @core

**File:** `app/core/index.ts` — add `export * from "./logger";`

### 2.6 Convert high-priority files (critical request paths)

See main plan for full table of ~52 files to migrate.

### 2.7 Add ESLint no-console rule

Set to `"warn"` initially to prevent new console calls while allowing gradual migration.

---

## Phase 3: Cross-Service Correlation + Full Migration

### 3.1 Rails → Langgraph correlation

**File:** `rails_app/app/clients/application_client.rb` — add `X-Request-Id` to `default_headers`

### 3.2 Browser → Langgraph correlation

**File:** `rails_app/app/javascript/frontend/hooks/useChatOptions.ts` — add `X-Request-Id` header

### 3.3 Bridge to LangSmith

Pass `requestId` as LangSmith metadata in the usage tracker callback.

### 3.4 Enrich Rollbar with request context

**File:** `app/core/errors/rollbar.ts` — auto-include `requestId`, `accountId`, `threadId` from ALS.

### 3.5 Overhaul error reporter infrastructure

Replace crude `devLogger` with Pino-based error reporting.

### 3.6 Migrate remaining ~150 console calls

### 3.7 Promote ESLint rule to error

---

## Phase 4: Log Aggregation Service

Recommendation: Logtail (Better Stack) — $0 free tier, native JSON, Render log drain integration.
