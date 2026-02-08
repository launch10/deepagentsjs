# Production Debugging & Observability

Structured logging via Pino (Langgraph) and Rails tagged logging, error tracking via Rollbar, agent traces via LangSmith, Google Ads API instrumentation via tagged logging, and conversation traces stored in PostgreSQL.

## Debugging Toolkit Overview

| Tool | What It Shows | How to Access |
|------|---------------|---------------|
| LangSmith | Full agent trace (nodes, LLM calls, tools, timing) | `/langsmith-trace` Claude skill or [smith.langchain.com](https://smith.langchain.com) |
| Conversation Traces | Messages, system prompt, token counts per run | `llm_conversation_traces` table in Postgres |
| Pino Logs | Structured JSON logs with request/thread correlation | stdout (production), pino-pretty (development) |
| Rollbar | Errors with request context | Rollbar dashboard |
| Google Ads Logs | API call summaries with domain model tags | Rails logs (tagged logging) |
| Sidekiq Web | Job queue status, failures, retries | Madmin admin panel |
| Langgraph REPL | Interactive Node.js console with all modules loaded | `pnpm repl` |

## LangSmith Agent Traces

Every graph execution is automatically traced in LangSmith. Traces show the full node execution hierarchy, every LLM call (model, tokens, prompts, responses), every tool call (input/output), and timing.

### Configuration

**File:** `langgraph_app/app/core/env.ts`

| Env Var | Purpose |
|---------|---------|
| `LANGSMITH_TRACING` | Enable/disable tracing |
| `LANGSMITH_ENDPOINT` | API endpoint |
| `LANGSMITH_API_KEY` | Authentication |
| `LANGSMITH_PROJECT` | Project name for grouping |

### Claude Skill: `/langsmith-trace`

**File:** `.claude/commands/langsmith-trace.md`

Fetches a LangSmith trace and displays a compact, glanceable summary directly in Claude Code. Accepts a trace URL or bare trace ID.

**Output format:**
```
--- TRACE SUMMARY ---
Trace:    cf642910-8a82-...
Name:     website                    Duration: 76.1s
Input:    "Let's make the hero scary like halloween"
Status:   ok

--- COST ---
LLM calls:  16        Tools used:  22
Total LLM:  63.1s     Total tools: 8.9s

--- CONDENSED TREE ---
website (76.1s)
  buildContext (0.0s)
  websiteBuilder (76.0s)
    intent detection (1.2s) -> 1 llm
    light-edit-agent (73.8s) -> 16 llm, 22 tools
         Agent loop (16 iterations):
           #1  llm 1.2s -> ls
           #2  llm 0.8s -> ls
           ...

--- RUN INDEX ---
#   ID (first 8)  Type   Name              Duration
1   a1b2c3d4      llm    ChatAnthropic     1.2s
2   e5f6g7h8      tool   ls                0.0s
...
```

**Drill-down:** Ask about any run by index or description. LLM runs show model, tokens, system prompt excerpt, response. Tool runs show name, input, output.

**Formatting rules:**
- Collapses LangGraph wrapper chains into breadcrumbs
- Collapses agent loops into per-iteration summaries
- Filters noise (ChannelWrite, Branch, __start__, __end__)
- Folds middleware (SummarizationMiddleware, todoListMiddleware) into parent iterations

## Conversation Traces (Database)

Every graph execution persists its conversation to the `llm_conversation_traces` table.

**Table:** `llm_conversation_traces` (partitioned by month)

| Column | Type | Purpose |
|--------|------|---------|
| `run_id` | string | Unique per graph execution |
| `thread_id` | string | Langgraph thread ID |
| `chat_id` | integer | Links to Rails Chat record |
| `graph_name` | string | Which graph (website, brainstorm, etc.) |
| `messages` | jsonb | Full conversation history |
| `system_prompt` | text | Extracted system prompt |
| `usage_summary` | jsonb | Token counts and costs |
| `llm_calls` | jsonb | Individual LLM call metadata |

**Rails model:** `LlmConversationTrace`

```ruby
# Find traces for a thread
LlmConversationTrace.for_thread("thread-uuid").recent

# Find traces for a chat
LlmConversationTrace.for_chat(chat_id).order(created_at: :desc)

# Cost and call count
trace.total_cost_cents  # => 4.2
trace.llm_call_count    # => 16
```

**Persistence pipeline:** `UsageTrackingCallbackHandler` captures token usage during execution, then `usageTrackingMiddleware` calls `persistTrace()` fire-and-forget after the graph completes.

See [billing/05-llm-usage-tracking.md](../billing/05-llm-usage-tracking.md) for the full tracking architecture.

## Structured Logging (Langgraph — Pino)

### Root Logger

**File:** `langgraph_app/app/core/logger/logger.ts`

Pino singleton with environment-specific configuration:

| Environment | Level | Transport | Output |
|-------------|-------|-----------|--------|
| Development | debug | pino-pretty (colorized, `HH:MM:ss.l`) | Human-readable |
| Production | info | None (plain JSON) | Log aggregator-ready |
| Test | silent | None | Suppressed |

Redacts sensitive fields: `jwt`, `authorization`, `token` (and nested variants).

Base bindings on every log line: `{ service: "langgraph", env: NODE_ENV }`.

### Context-Aware Logging

**File:** `langgraph_app/app/core/logger/context.ts`

Uses `AsyncLocalStorage` to propagate request-scoped child loggers:

```typescript
import { getLogger } from "@core";

const logger = getLogger();
logger.info({ userId: 123 }, "Processing request");
// Output includes: requestId, threadId, graphName, nodeName (auto-attached)
```

Auto-attaches from context:
- `requestId` — from HTTP request or graph execution
- `threadId` — Langgraph thread
- `graphName` — which graph is running
- `nodeName` — which node is executing (from `getNodeContext()`)

### Request Logger Middleware

**File:** `langgraph_app/app/server/middleware/requestLogger.ts`

Hono middleware that:
1. Generates or accepts `X-Request-Id` from incoming headers
2. Sets `X-Request-Id` response header (for cross-service correlation)
3. Logs request start and completion with duration

```json
{"level":"info","requestId":"abc-123","method":"POST","path":"/api/website/stream","msg":"request start"}
{"level":"info","requestId":"abc-123","method":"POST","path":"/api/website/stream","status":200,"durationMs":76100,"msg":"request end"}
```

### Graph Logging Middleware

**File:** `langgraph_app/app/api/middleware/logging.ts`

Creates a logging context per graph execution using `createStorageMiddleware`. The child logger includes `requestId`, `threadId`, and `graphName`, and propagates to all nodes via AsyncLocalStorage.

## Error Tracking (Rollbar)

### Langgraph

**File:** `langgraph_app/app/core/errors/rollbar.ts`

- Enabled when `ROLLBAR_ACCESS_TOKEN` env var is set
- `captureUncaught: true` and `captureUnhandledRejections: true`
- Auto-enriches context with `requestId` from logger AsyncLocalStorage

```typescript
import { rollbar } from "@core";

rollbar.error(error, { threadId: "...", userId: 123 });
rollbar.warn("Something unexpected", { context: "..." });
```

### Rails

**File:** `rails_app/config/initializers/rollbar.rb`

- DSN from `Rails.application.credentials.dig(:rollbar, :access_token)`
- Active in production and staging

## Google Ads API Logging

**Decision:** [ADR-001: Google Ads Instrumentation](../decisions/google_ads/001-instrumentation-and-logging.md)

Uses the Google Ads gem's built-in `LoggingInterceptor` combined with Rails `ActiveSupport::TaggedLogging`.

### How It Works

```
Resource class (Campaign, AdGroup, Ad, etc.)
  │ includes Instrumentable
  │ instrument_methods :sync, :sync_result, etc.
  ▼
GoogleAds::Instrumentation.with_context(campaign: record)
  │ builds tags from domain objects
  ▼
Rails Tagged Logging
  │ [campaign_id=42] [google_customer_id=1234567890] [account_id=7]
  ▼
Google Ads Gem LoggingInterceptor
  INFO  = summaries (method, customer_id, duration)
  DEBUG = full JSON payloads
```

### Log Levels

**File:** `rails_app/config/initializers/google_ads_config.rb`

| Environment | Level | Logger | Detail |
|-------------|-------|--------|--------|
| Production | INFO | `Rails.logger` | Summaries only |
| Development/Test | DEBUG | `log/google_ads.log` | Full payloads |

### Tag Convention

| Tag | Source | Example |
|-----|--------|---------|
| `campaign_id` | Our internal ID | `42` |
| `ad_group_id` | Our internal ID | `15` |
| `google_customer_id` | Google's external ID | `1234567890` |
| `account_id` | Our internal ID | `7` |

Tags are formatted as `key=value` in brackets, auto-parseable by Datadog as facets.

### Example Output

```
[campaign_id=42] [google_customer_id=1234567890] [account_id=7]
  Google::Ads::GoogleAds V18 CampaignService.mutate_campaigns
  Request: customer_id=1234567890, operations=[...]
  Response: results=[{resource_name: "customers/1234567890/campaigns/999"}]
  Duration: 234ms
```

### Instrumented Resources

| Resource | Context Tags |
|----------|-------------|
| Campaign | `campaign_id`, `google_customer_id`, `account_id` |
| AdGroup | `ad_group_id`, `campaign_id`, `google_customer_id`, `account_id` |
| Ad | `ad_id`, `ad_group_id`, `campaign_id`, `google_customer_id`, `account_id` |
| Budget | `budget_id`, `campaign_id`, `google_customer_id`, `account_id` |
| Keyword | `keyword_id`, `ad_group_id`, `campaign_id`, `google_customer_id`, `account_id` |
| AdSchedule, Callout, LocationTarget, StructuredSnippet, Favicon | Inherits from campaign |
| Account, AccountInvitation | `account_id`, `google_customer_id` |

## Rails Production Logging

**File:** `rails_app/config/environments/production.rb`

- Output: STDOUT via `ActiveSupport::TaggedLogging`
- Tags: `[:request_id]` (Rails request ID in every log line)
- Level: `ENV.fetch("RAILS_LOG_LEVEL", "info")`
- Health checks silenced: `/up`

## Sidekiq Monitoring

**Access:** Sidekiq Web UI via the Madmin admin panel

Shows queue depths, active jobs, scheduled jobs, retries, dead jobs. See [background-jobs.md](./background-jobs.md) for queue configuration and retry strategies.

## Langgraph REPL

**File:** `langgraph_app/scripts/repl.ts`

Interactive Node.js console with all application modules pre-loaded.

```bash
pnpm repl              # Development environment
NODE_ENV=test pnpm repl  # Test environment
```

**Available globals:**

| Global | Purpose |
|--------|---------|
| `types` | All type definitions |
| `core` | Core utilities (`core.getLLM`, etc.) |
| `services` | All services |
| `nodes` | All Langgraph nodes |
| `tools` | All tools |
| `graphs` | All graph definitions |
| `prompts` | All prompt templates |
| `utils` | All utilities |

**Utility functions:** `clear()`, `pp(obj, depth)`, `reload(modulePath)`, `help()`

**Commands:** `.env` shows environment variables (masks sensitive values).

## Request Correlation

Cross-service request tracking via `X-Request-Id`:

```
Browser/Rails → HTTP POST → Langgraph
                 │ X-Request-Id header
                 ▼
Hono requestLogger middleware
  │ generates or accepts X-Request-Id
  │ stores on Hono context
  ▼
Graph logging middleware
  │ creates child logger with requestId
  │ propagates via AsyncLocalStorage
  ▼
All node logs include requestId
  │
  ├── Rollbar errors enriched with requestId
  └── LangSmith traces linkable via requestId (planned)
```

## Debugging Workflows

### "User says the page looks wrong after an edit"

1. Find the thread ID from the Chat record in Rails console
2. Query `LlmConversationTrace.for_thread(thread_id).recent` to see what happened
3. Get the `run_id` and open the LangSmith trace, or use `/langsmith-trace <run_id>`
4. Drill into the agent loop to see which files were edited and what the LLM decided

### "Google Ads sync failed"

1. Check Sidekiq Web for failed jobs in the Madmin panel
2. Search Rails logs by `[campaign_id=X]` or `[google_customer_id=Y]` to find the API call
3. In development, check `log/google_ads.log` for full request/response payloads
4. Check Rollbar for the error with stack trace

### "Agent is slow or expensive"

1. Use `/langsmith-trace <trace-url>` to get the timing breakdown
2. Check the condensed tree: long LLM calls indicate large prompts or complex reasoning
3. Check token counts in `llm_conversation_traces.usage_summary`
4. Compare with typical runs to identify regressions

### "Background job isn't running"

1. Check Sidekiq Web: is the job queued, retrying, or dead?
2. Check Zhong schedule: is the cron job registered? (See `schedule.rb`)
3. Check Redis isolation: is the right Redis DB being used? (`bin/services env`)

## Key Files Index

| File | Purpose |
|------|---------|
| `.claude/commands/langsmith-trace.md` | Claude skill for fetching LangSmith traces |
| `langgraph_app/app/core/logger/logger.ts` | Root Pino logger singleton |
| `langgraph_app/app/core/logger/context.ts` | AsyncLocalStorage context propagation |
| `langgraph_app/app/server/middleware/requestLogger.ts` | Hono request logging middleware |
| `langgraph_app/app/api/middleware/logging.ts` | Graph-level logging middleware |
| `langgraph_app/app/core/errors/rollbar.ts` | Rollbar error tracking (Langgraph) |
| `langgraph_app/app/core/billing/tracker.ts` | Usage tracking callback handler |
| `langgraph_app/app/core/billing/persist.ts` | Trace and usage persistence |
| `langgraph_app/scripts/repl.ts` | Interactive REPL |
| `rails_app/config/initializers/rollbar.rb` | Rollbar error tracking (Rails) |
| `rails_app/config/initializers/google_ads_config.rb` | Google Ads logger configuration |
| `rails_app/app/services/google_ads/instrumentation.rb` | Google Ads instrumentation module |
| `rails_app/app/services/google_ads/resources/instrumentable.rb` | Instrumentable concern |
| `rails_app/app/models/llm_conversation_trace.rb` | Conversation trace model |

## Related Docs

- [billing/05-llm-usage-tracking.md](../billing/05-llm-usage-tracking.md) — Full token tracking architecture
- [infrastructure/background-jobs.md](./background-jobs.md) — Sidekiq queues, Zhong cron, retry strategies
- [decisions/google_ads/001-instrumentation-and-logging.md](../decisions/google_ads/001-instrumentation-and-logging.md) — Google Ads instrumentation ADR
