# Migrate from LangSmith to Langfuse + PostHog

## Context

LangSmith auto-tracing (`LANGSMITH_TRACING=true`) costs $104/mo for local dev only. The fragmented trace counting (LangGraph nodes appearing as separate root traces) inflates usage ~10x. Meanwhile, we already have a custom PostgreSQL-based tracing system for billing (`app/core/billing/tracker.ts`) and use PostHog for product analytics.

**Goal**: Replace LangSmith with Langfuse for LLM trace debugging, pipe aggregated metrics to PostHog, and set up the Langfuse MCP server to replace the `langsmith-trace` skill in Claude Code.

## Step 1: Kill LangSmith (stop the $104/mo bleed)

**Files:**
- `langgraph_app/.env` — set `LANGSMITH_TRACING=false`
- `langgraph_app/.env.test` — same
- `langgraph_app/.env.ci` — same (if exists)
- `langgraph_app/app/core/env.ts` (lines 18-22) — make LANGSMITH vars optional:

```typescript
LANGSMITH_TRACING: z.string().optional(),
LANGSMITH_ENDPOINT: z.string().optional(),
LANGSMITH_API_KEY: z.string().optional(),
LANGSMITH_PROJECT: z.string().optional(),
```

## Step 2: Set up Langfuse Cloud (free tier)

1. Create account at langfuse.com (Hobby = free, 50K units/mo)
2. Create a project, get API keys
3. Add to `langgraph_app/.env` and `.env.test`:

```
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

4. Update `langgraph_app/app/core/env.ts` — add optional Langfuse vars:

```typescript
LANGFUSE_PUBLIC_KEY: z.string().optional(),
LANGFUSE_SECRET_KEY: z.string().optional(),
LANGFUSE_BASE_URL: z.string().optional(),
```

## Step 3: Install Langfuse SDK v4

Langfuse SDK v4 is built on OpenTelemetry. Three packages needed:

```bash
cd langgraph_app && pnpm add @langfuse/langchain @langfuse/otel @opentelemetry/sdk-node
```

- `@langfuse/langchain` — `CallbackHandler` for LangChain/LangGraph (extends `BaseCallbackHandler`)
- `@langfuse/otel` — `LangfuseSpanProcessor` (REQUIRED for v4 — the callback handler won't work without it)
- `@opentelemetry/sdk-node` — OpenTelemetry Node.js SDK

## Step 4: OTEL instrumentation (must load first)

**Create `langgraph_app/app/core/tracing/instrumentation.ts`:**

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

// Reads LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL from env
export const langfuseSpanProcessor = new LangfuseSpanProcessor();

const sdk = new NodeSDK({
  spanProcessors: [langfuseSpanProcessor],
});

sdk.start();
```

**Import at the top of `langgraph_app/server.ts`** (line 1, before all other imports):

```typescript
import "./app/core/tracing/instrumentation"; // Must be first
import { Hono } from "hono";
// ... rest of imports
```

OTEL instrumentation must initialize before LangChain modules load so spans are captured.

## Step 5: Add Langfuse callback via SDK middleware

This is the key architectural decision. We inject the Langfuse `CallbackHandler` at the **graph invocation level** (not per-LLM), so one graph execution = one Langfuse trace with nested spans.

### 5a. Add `callbacks` support to langgraph-ai-sdk

**`packages/langgraph-ai-sdk/.../middleware/types.ts`** — add callbacks to context:

```typescript
export interface StreamMiddlewareContext<TState = any> {
  // ... existing fields ...
  /** Callback handlers for trace providers (e.g., Langfuse) */
  callbacks: import("@langchain/core/callbacks/base").BaseCallbackHandler[];
}
```

**`packages/langgraph-ai-sdk/.../agent.ts`** (line 277-286) — initialize callbacks array:

```typescript
const middlewareContext: StreamMiddlewareContext<TState> = {
  // ... existing fields ...
  callbacks: [],  // Middleware can push handlers here
};
```

**`packages/langgraph-ai-sdk/.../agent.ts`** (line 289-299) — forward callbacks to stream:

```typescript
const createStream = () =>
  createLanggraphStreamResponse<TGraphData>({
    // ... existing fields ...
    callbacks: middlewareContext.callbacks,  // Forward to graph.streamEvents
  });
```

**`packages/langgraph-ai-sdk/.../stream.ts`** (line 90-102) — add callbacks to config:

```typescript
export interface LanggraphStreamConfig<...> {
  // ... existing fields ...
  /** Callback handlers forwarded to graph.streamEvents */
  callbacks?: import("@langchain/core/callbacks/base").BaseCallbackHandler[];
}
```

**`packages/langgraph-ai-sdk/.../stream.ts`** (lines 816-822) — forward callbacks:

```typescript
const stream = graph.streamEvents(graphState, {
  version: "v2",
  streamMode: ["messages", "updates", "custom"],
  subgraphs: true,
  context: { graphName: graph.name },
  configurable: { thread_id: threadId },
  ...(metadata && Object.keys(metadata).length > 0 && { metadata }),
  ...(callbacks && callbacks.length > 0 && { callbacks }),  // NEW
});
```

### 5b. Create Langfuse middleware

**Create `langgraph_app/app/api/middleware/langfuseTracing.ts`:**

```typescript
import { createMiddlewareFromHooks, type StreamMiddleware } from "langgraph-ai-sdk";
import { CallbackHandler } from "@langfuse/langchain";
import { env } from "@core";

export const langfuseTracingMiddleware: StreamMiddleware<any> = createMiddlewareFromHooks({
  name: "langfuse-tracing",

  async onStart(ctx) {
    if (!env.LANGFUSE_PUBLIC_KEY || !env.LANGFUSE_SECRET_KEY) return;

    const handler = new CallbackHandler({
      sessionId: ctx.threadId,
      userId: ctx.data.get("userId") as string | undefined,
      tags: [ctx.graphName || "unknown"],
      metadata: {
        requestId: ctx.requestId,
        graphName: ctx.graphName,
      },
    });

    ctx.callbacks.push(handler);
  },
});
```

### 5c. Wire into appBridge

**`langgraph_app/app/api/middleware/appBridge.ts`** — add Langfuse middleware:

```typescript
import { createBridgeFactory } from "langgraph-ai-sdk";
import { usageTrackingMiddleware } from "./usageTracking";
import { langfuseTracingMiddleware } from "./langfuseTracing";

export const createAppBridge = createBridgeFactory({
  middleware: [langfuseTracingMiddleware, usageTrackingMiddleware],
});
```

Langfuse middleware runs first (outermost), so the handler is available before the graph streams.

## Step 6: Pass userId through context

Route handlers need to pass the authenticated user's ID via context so the middleware can tag traces. Check each route handler's `.stream()` call and ensure `context: { userId }` is passed. Example:

```typescript
// In route handlers (deploy.ts, brainstorm.ts, website.ts, etc.)
return DeployAPI.stream({
  messages: [],
  threadId,
  state: { ... },
  context: { userId: c.get("userId"), chatId },
});
```

Verify this is already being done — if `chatId` is already in context, `userId` likely is too.

## Step 7: Langfuse → PostHog integration (dashboard config)

In Langfuse Cloud dashboard:
1. Settings → Integrations → PostHog
2. Enter PostHog API key and host
3. Langfuse batch-sends aggregated LLM metrics to PostHog hourly

No code changes needed.

## Step 8: Replace langsmith-trace skill with Langfuse MCP server

**Install community Langfuse MCP server** ([avivsinai/langfuse-mcp](https://github.com/avivsinai/langfuse-mcp)):

```bash
claude mcp add langfuse-mcp \
  -e LANGFUSE_PUBLIC_KEY=pk-lf-... \
  -e LANGFUSE_SECRET_KEY=sk-lf-... \
  -e LANGFUSE_HOST=https://us.cloud.langfuse.com \
  -- npx -y langfuse-mcp
```

25 tools available (replaces and exceeds the langsmith-trace skill):
- `fetch_traces` / `fetch_trace` — query and drill into traces
- `fetch_observations` / `fetch_observation` — view LLM calls, tool calls
- `fetch_sessions` / `get_session_details` — session views
- `find_exceptions` — error tracking
- `list_prompts` / `get_prompt` — prompt management

Archive `.claude/commands/langsmith-trace.md` after confirming MCP server works.

## Step 9: Clean up (after validation)

- Remove `langsmith` from `langgraph_app/package.json`
- Remove LANGSMITH env vars from all env files
- Remove LANGSMITH fields from `env.ts` schema
- Cancel LangSmith subscription

## Key Files

| File | Change |
|------|--------|
| `langgraph_app/server.ts` | Add OTEL instrumentation import (line 1) |
| `langgraph_app/app/core/env.ts` | Make LANGSMITH optional, add LANGFUSE vars |
| `langgraph_app/app/core/tracing/instrumentation.ts` | **New** — OTEL + LangfuseSpanProcessor setup |
| `langgraph_app/app/api/middleware/langfuseTracing.ts` | **New** — Langfuse CallbackHandler middleware |
| `langgraph_app/app/api/middleware/appBridge.ts` | Add langfuseTracingMiddleware |
| `packages/langgraph-ai-sdk/.../middleware/types.ts` | Add `callbacks` to StreamMiddlewareContext |
| `packages/langgraph-ai-sdk/.../agent.ts` | Initialize callbacks array, forward to stream |
| `packages/langgraph-ai-sdk/.../stream.ts` | Add callbacks to config, forward to streamEvents |
| `langgraph_app/.env` | Remove LANGSMITH, add LANGFUSE vars |
| `langgraph_app/.env.test` | Same |
| `langgraph_app/package.json` | Add `@langfuse/*`, remove `langsmith` |
| `.claude/commands/langsmith-trace.md` | Archive |

## Verification

1. **Tracing works**: Run `bin/dev`, trigger a brainstorm/website graph, check Langfuse dashboard for one trace with nested spans (LLM calls, tool calls as child observations)
2. **Trace grouping**: Confirm one graph invocation = one trace (not fragmented like LangSmith)
3. **Existing billing unaffected**: Verify `usageTracker` still captures usage in PostgreSQL
4. **PostHog integration**: After ~1 hour, check PostHog for Langfuse-sourced LLM metrics
5. **MCP server**: From Claude Code, query a recent trace via the Langfuse MCP tools
6. **No LangSmith traffic**: Confirm no requests to `api.smith.langchain.com`

## Deployment: Langfuse Cloud (managed)

Using Langfuse Cloud (managed) — no self-hosting, no ClickHouse, no extra infra. Just API keys.
- **Hobby tier**: Free, 50K units/mo, 30-day retention
- **Core tier** (if needed later): $59/mo, 100K units, 90-day retention

## Cost Comparison

| | LangSmith (current) | Langfuse Cloud (Hobby) |
|---|---|---|
| Monthly cost | **$104+** | **$0** (50K units free) |
| Trace querying | Custom skill (REST API) | Community MCP server (25 tools) |
| PostHog integration | None | Dashboard config |
