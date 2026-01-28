# LLM Usage Tracking

## Overview

Every LLM call during a graph execution is tracked transparently via a callback handler and AsyncLocalStorage. Token counts are captured in real-time and persisted to the `llm_usage` table after the graph completes.

## How It Works

### 1. Context Creation

Before a graph executes, `createUsageContext()` creates a fresh `UsageContext` with a unique `runId`. This context is propagated through Node.js's `AsyncLocalStorage`, making it available to all async code within the graph execution without passing state explicitly.

### 2. Token Capture

The `UsageTrackingCallbackHandler` is attached to every LLM instance via `getLLM()`. It implements two LangChain callbacks:

- **`handleChatModelStart`**: Captures input messages, deduplicates by message ID
- **`handleLLMEnd`**: Extracts `usage_metadata` from the LLM response and records:
  - `inputTokens`
  - `outputTokens`
  - `reasoningTokens` (for models like Claude that expose thinking tokens)
  - `cacheCreationTokens`
  - `cacheReadTokens`

Each callback call creates a `UsageRecord` and appends it to the context's `records` array.

### 3. Persistence

After graph execution, `persistUsage()` writes all accumulated `UsageRecord` entries to the `llm_usage` database table. This function:

- Maps each `UsageRecord` to the database row format
- Retries up to 3 times with exponential backoff on failure
- Runs independently of the graph response (fire-and-forget)

### 4. Conversation Traces

`persistTrace()` writes conversation messages to `llm_conversation_traces` separately. This stores:

- Full message history with `is_context_message` flag
- System prompt extracted separately for convenience
- Linked to the same `runId` as usage records

## Key Files

| File | Purpose |
|------|---------|
| `langgraph_app/app/core/billing/storage.ts` | `createUsageContext()`, `getUsageContext()` via AsyncLocalStorage |
| `langgraph_app/app/core/billing/tracker.ts` | `UsageTrackingCallbackHandler` — LangChain callback |
| `langgraph_app/app/core/billing/persist.ts` | `persistUsage()`, `persistTrace()` — database writes |
| `langgraph_app/app/core/billing/types.ts` | `UsageRecord`, `UsageContext`, `TraceContext`, `UsageSummary` |

## Key Concepts

### AsyncLocalStorage Pattern

The usage context uses Node.js `AsyncLocalStorage` to propagate tracking state through the call stack without threading it through every function parameter. This means:

- Nodes don't need to know about billing
- Tool calls within agents automatically contribute to the same context
- Multi-turn agent loops are tracked under a single `runId`
- The context survives across async boundaries (promises, callbacks)

### UsageRecord Fields

| Field | Type | Description |
|-------|------|-------------|
| `runId` | string | Groups all records for a single graph execution |
| `messageId` | string | Deduplication key for messages |
| `langchainRunId` | string | LangChain's internal run identifier |
| `model` | string | Model name (e.g., `claude-sonnet-4-20250514`) |
| `inputTokens` | number | Prompt tokens |
| `outputTokens` | number | Completion tokens |
| `reasoningTokens` | number | Thinking/reasoning tokens (Claude extended thinking) |
| `cacheCreationTokens` | number | Tokens used to create cache entries |
| `cacheReadTokens` | number | Tokens read from cache |
| `timestamp` | Date | When the LLM call occurred |
| `tags` | string[] | LangChain tags for categorization |
| `metadata` | object | Additional metadata from the LLM call |

### UsageContext Accumulation

The `UsageContext` accumulates data during graph execution:

- `records[]` — all LLM call records
- `messages[]` — conversation messages for trace persistence
- `_seenMessageIds` — Set for deduplication
- `chatId`, `threadId`, `graphName`, `accountId` — context metadata
- `preRunCreditsRemaining` — snapshot from pre-run credit check

## Related Docs

- [06-credit-charging.md](./06-credit-charging.md) - How usage records become charges
- [07-pre-run-authorization.md](./07-pre-run-authorization.md) - Pre-run credit check that sets `preRunCreditsRemaining`
- [00-architecture-overview.md](./00-architecture-overview.md) - Full system data flow
