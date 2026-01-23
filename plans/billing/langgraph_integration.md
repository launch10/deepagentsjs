# Langgraph Credit Integration

## Overview

This document describes how to track **all** AI usage in Langgraph and charge credits accordingly.

**Key insight**: Node-level middleware can't catch LLM calls inside agents, tools, or other middlewares. We use LangChain's **callback system** with **AsyncLocalStorage** to intercept every LLM call, regardless of where it happens in the call stack.

**Architecture summary**:
1. `usageTracker` - LLM-level callback attached to all models via `getLLM()`, fires `handleLLMEnd` for each LLM call
2. `billingCallback` - Graph-level callback passed to `graph.invoke()`, fires `handleChainEnd` when graph completes
3. `runWithUsageTracking()` - Wraps graph execution, sets up AsyncLocalStorage context
4. All persistence happens in `handleChainEnd` - no Hono handler logic needed

**Why graph-level callbacks?** Billing logic lives with the graph, not scattered to Hono handlers. This makes it testable via our existing `GraphTestBuilder` infrastructure (which wraps `graph.invoke()`).

## Message Flow in Langgraph

### Tool Call Sequence

When an agent calls tools, the message sequence is:

```
1. AIMessage (has usage_metadata ✓)
   - tool_calls: [{ id, name, args }]
   - usage_metadata: { input_tokens, output_tokens, cache_* }

2. ToolMessage(s) - one per tool (NO usage_metadata ✗)
   - tool_call_id: matches AIMessage tool_call id
   - content: tool execution result

3. AIMessage (has usage_metadata ✓)
   - Processes tool results
   - May call more tools (repeat cycle)
```

### Usage Metadata

Only `AIMessage` has `usage_metadata`. `ToolMessage` does NOT - it's just the result of executing code, no LLM call involved.

```typescript
// AIMessage.usage_metadata structure (unified across providers)
{
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;

  // Provider-specific token details
  input_token_details?: {
    cache_creation?: number;  // Anthropic: tokens written to cache
    cache_read?: number;      // Anthropic: tokens read from cache (90% cheaper)
    audio?: number;           // OpenAI: audio input tokens
  };

  output_token_details?: {
    reasoning?: number;       // OpenAI: reasoning/thinking tokens (included in output_tokens)
    audio?: number;           // OpenAI: audio output tokens
  };

  // Legacy fields (some providers use these instead of nested details)
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}
```

**Key insight**: Usage is per-message, not cumulative. To get total cost for a run, sum across all AIMessages.

## What to Persist & Charge

| Message Type | Has Usage? | Charge? | Persist? |
|--------------|------------|---------|----------|
| `AIMessage` | ✓ Yes | ✓ Yes | ✓ Yes |
| `ToolMessage` | ✗ No | ✗ No | ✓ Yes (audit trail) |
| `HumanMessage` | ✗ No | ✗ No | ✓ Yes (audit trail) |

## Edge Cases

| Scenario | What Happens | Action |
|----------|--------------|--------|
| **Node doesn't call LLM** | Returns `{ messages: [] }` or state-only | No charge, nothing to persist |
| **Agent calls multiple tools** | 1 AIMessage + N ToolMessages + 1 AIMessage | Charge each AIMessage |
| **Streaming** | Not used in codebase (all `.invoke()`) | N/A |
| **Retry on error** | `withErrorHandling` catches, stores in state | No new messages = no charge |
| **Parallel nodes** | Graph handles via edges | Each middleware runs independently |
| **Pseudo messages** | System-injected, filtered before save | Don't persist or charge |

## Architecture

### Why Node-Level Middleware Isn't Enough

A node-level middleware (wrapping each node to detect new messages) misses LLM calls that happen:

1. **Inside agents**: Agents run multiple internal LLM calls (tool call → tool execution → another LLM call → repeat). The node only returns final state, not intermediate AIMessages.

2. **Inside tools**: Tools like `saveAnswersTool` call `getLLM()` directly to summarize messages. These LLM calls don't produce messages returned to the caller.

3. **Inside middlewares**: `SummarizationMiddleware` and other middlewares use LLMs internally.

### Solution: LLM-Level Callback Tracking

We use LangChain's callback system to intercept **every** LLM call, regardless of where it happens. The callback is a stateless singleton that stores usage to AsyncLocalStorage.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                         Graph Execution ("Run")                               │
│                                                                               │
│  graph.invoke(state, { callbacks: [usageTracker, billingCallback] })          │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │   runWithUsageTracking() - Sets up AsyncLocalStorage context            │  │
│  │                                                                          │  │
│  │   ┌──────────────┐    ┌──────────────┐    ┌────────────────────┐        │  │
│  │   │brainstormAgent│   │saveAnswersTool│   │SummarizationMiddleware│     │  │
│  │   │              │    │              │    │                    │        │  │
│  │   │ getLLM() ────┼────┼──getLLM() ───┼────┼── getLLM() ────────┤        │  │
│  │   └──────────────┘    └──────────────┘    └────────────────────┘        │  │
│  │         │                    │                      │                   │  │
│  │         └────────────────────┴──────────────────────┘                   │  │
│  │                              │                                          │  │
│  │                              ▼                                          │  │
│  │              ┌───────────────────────────────┐                          │  │
│  │              │   usageTracker (LLM-level)    │                          │  │
│  │              │   Attached to every model     │                          │  │
│  │              │                               │                          │  │
│  │              │   handleLLMEnd() → reads      │                          │  │
│  │              │   AsyncLocalStorage context   │                          │  │
│  │              │   → accumulates UsageRecord   │                          │  │
│  │              └───────────────────────────────┘                          │  │
│  │                                                                          │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  Graph completes (all nodes done)                                             │
│                     │                                                         │
│                     ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │   billingCallback (Graph-level)                                         │  │
│  │   Passed to graph.invoke()                                              │  │
│  │                                                                          │  │
│  │   handleChainEnd() → reads AsyncLocalStorage                            │  │
│  │                   → persistUsageToRails(records)                        │  │
│  │                                                                          │  │
│  │   handleChainError() → still persist (charge for work done)             │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Two Callback Layers

| Callback | Level | Event | Purpose |
|----------|-------|-------|---------|
| `usageTracker` | LLM | `handleLLMEnd` | Accumulate usage for each LLM call |
| `billingCallback` | Graph | `handleChainEnd` | Persist all accumulated usage to Rails |

### Core Components

#### 1. UsageTrackingCallback + AsyncLocalStorage Context

```typescript
// langgraph_app/app/core/billing/usageTracker.ts

import { AsyncLocalStorage } from "node:async_hooks";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { LLMResult } from "@langchain/core/outputs";
import type { AIMessage } from "@langchain/core/messages";

// ----- Types -----

export interface UsageRecord {
  runId: string;
  parentRunId?: string;
  model: string;
  normalizedModel: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  timestamp: Date;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UsageContext {
  records: UsageRecord[];
  chatId?: number;
  threadId?: string;
  graphName?: string;
}

// ----- AsyncLocalStorage -----

const usageStorage = new AsyncLocalStorage<UsageContext>();

export function getUsageContext(): UsageContext | undefined {
  return usageStorage.getStore();
}

export async function runWithUsageTracking<T>(
  context: Partial<UsageContext>,
  fn: () => T | Promise<T>
): Promise<{ result: T; usage: UsageRecord[] }> {
  const fullContext: UsageContext = { records: [], ...context };
  return usageStorage.run(fullContext, async () => {
    const result = await fn();
    return { result, usage: fullContext.records };
  });
}

// ----- Callback Handler (Singleton) -----

class UsageTrackingCallbackHandler extends BaseCallbackHandler {
  name = "usage-tracking";

  async handleLLMEnd(
    output: LLMResult,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    extraParams?: Record<string, unknown>
  ): Promise<void> {
    const context = getUsageContext();
    if (!context) return; // Not in a tracked context - safe no-op

    // Extract usage from generations
    for (const generationBatch of output.generations ?? []) {
      for (const generation of generationBatch) {
        const message = (generation as any).message as AIMessage | undefined;
        if (message?.usage_metadata) {
          const record = this.extractUsageRecord(message, output.llmOutput, runId, parentRunId, tags, extraParams);
          context.records.push(record);
        }
      }
    }
  }

  private extractUsageRecord(
    message: AIMessage,
    llmOutput: any,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    extraParams?: Record<string, unknown>
  ): UsageRecord {
    const usage = (message as any).usage_metadata;
    const responseMeta = (message as any).response_metadata || llmOutput || {};

    // Model name: OpenAI uses model_name, Anthropic uses model
    const model = responseMeta.model_name || responseMeta.model || "unknown";
    const normalizedModel = normalizeModelName(model);

    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const reasoningTokens = usage.output_token_details?.reasoning || 0;
    const cacheCreationTokens =
      usage.cache_creation_input_tokens ||
      usage.input_token_details?.cache_creation || 0;
    const cacheReadTokens =
      usage.cache_read_input_tokens ||
      usage.input_token_details?.cache_read || 0;

    const costUsd = calculateCost({
      model: normalizedModel,
      inputTokens,
      outputTokens,
      reasoningTokens,
      cacheCreationTokens,
      cacheReadTokens,
    });

    return {
      runId,
      parentRunId,
      model,
      normalizedModel,
      inputTokens,
      outputTokens,
      reasoningTokens,
      cacheCreationTokens,
      cacheReadTokens,
      costUsd,
      timestamp: new Date(),
      tags,
      metadata: extraParams?.metadata as Record<string, unknown>,
    };
  }
}

// Singleton instance - attached to all models
export const usageTracker = new UsageTrackingCallbackHandler();
```

#### 2. BillingCallback (Graph-Level Persistence)

```typescript
// langgraph_app/app/core/billing/billingCallback.ts

import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { ChainValues } from "@langchain/core/utils/types";
import { getUsageContext } from "./usageTracker";
import { persistUsageToRails } from "./persistUsage";

class BillingCallbackHandler extends BaseCallbackHandler {
  name = "billing";

  async handleChainEnd(
    output: ChainValues,
    runId: string
  ): Promise<void> {
    const context = getUsageContext();
    if (!context || context.records.length === 0) return;

    // Persist all accumulated usage
    await persistUsageToRails(
      context.records,
      context.chatId!,
      context.graphName
    );
  }

  async handleChainError(
    error: Error,
    runId: string
  ): Promise<void> {
    // Still persist usage even on error - charge for work done
    const context = getUsageContext();
    if (!context || context.records.length === 0) return;

    await persistUsageToRails(
      context.records,
      context.chatId!,
      context.graphName
    );
  }
}

// Singleton instance - passed to graph.invoke()
export const billingCallback = new BillingCallbackHandler();
```

#### 3. Modify getLLM to Attach usageTracker

```typescript
// langgraph_app/app/core/llm/llm.ts

import { usageTracker } from "../billing/usageTracker";

export async function getLLM(options: LLMOptions = {}): Promise<BaseChatModel> {
  const model = await LLMManager.get(/* existing logic */);

  // Always attach usage tracking callback
  // The callback safely no-ops when not in a tracked context
  return model.withConfig({
    callbacks: [usageTracker],
    metadata: {
      skill: options.skill,
      maxTier: options.maxTier,
    },
  });
}
```

#### 4. Wrap Graph Execution

```typescript
// langgraph_app/app/core/billing/withUsageTracking.ts

import { runWithUsageTracking, usageTracker } from "./usageTracker";
import { billingCallback } from "./billingCallback";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

interface RunOptions {
  chatId: number;
  graphName?: string;
}

/**
 * Execute a graph with full billing tracking.
 *
 * - Sets up AsyncLocalStorage context for usage accumulation
 * - Passes both usageTracker and billingCallback to graph
 * - billingCallback handles persistence in handleChainEnd
 */
export async function executeWithBilling<TInput, TOutput>(
  graph: CompiledGraph<TInput, TOutput>,
  input: TInput,
  config: LangGraphRunnableConfig,
  options: RunOptions
): Promise<TOutput> {
  const { result } = await runWithUsageTracking(
    {
      chatId: options.chatId,
      threadId: config?.configurable?.thread_id,
      graphName: options.graphName,
    },
    () => graph.invoke(input, {
      ...config,
      callbacks: [
        ...(config.callbacks || []),
        usageTracker,      // LLM-level: accumulates usage
        billingCallback,   // Graph-level: persists on completion
      ],
    })
  );

  // No explicit persistence needed - billingCallback handles it
  return result;
}
```

#### 5. Usage in Hono Server

```typescript
// In graph invocation handler - clean and simple

const result = await executeWithBilling(
  brainstormGraph,
  state,
  { configurable: { thread_id: threadId } },
  { chatId: chat.id, graphName: "brainstorm" }
);

// That's it! Persistence happens in billingCallback.handleChainEnd()
```

#### 6. Integration with GraphTestBuilder

The billing system is fully testable via our existing `testGraph()` infrastructure:

```typescript
// tests/support/graph/graphTester.ts additions

class GraphTestBuilder<TGraphState extends CoreGraphState> {
  private billingEnabled = false;

  /**
   * Enable billing tracking for this test.
   * Usage will be accumulated and can be asserted on after execution.
   */
  withBilling(): GraphTestBuilder<TGraphState> {
    this.billingEnabled = true;
    return this;
  }

  async execute(): Promise<NodeTestResult<TGraphState>> {
    // ... existing setup ...

    if (this.billingEnabled) {
      // Wrap execution with billing
      const { result } = await runWithUsageTracking(
        { chatId: this.initialState.chatId, graphName: this.graph?.name },
        () => testGraph.invoke(initialState, {
          ...invokeConfig,
          callbacks: [usageTracker, billingCallback],
        })
      );
      // ... handle result ...
    } else {
      // Existing non-billing path
      const result = await testGraph.invoke(initialState, invokeConfig);
      // ...
    }
  }
}

// Usage in tests:
it("tracks usage for brainstorm agent", async () => {
  const result = await testGraph()
    .withGraph(brainstormGraph)
    .withPrompt("Help me brainstorm ideas for a dog walking app")
    .withBilling()
    .execute();

  // Assert usage was captured
  const context = getUsageContext();
  expect(context?.records.length).toBeGreaterThan(0);

  // Assert cost calculation
  const totalCost = context?.records.reduce((sum, r) => sum + r.costUsd, 0);
  expect(totalCost).toBeGreaterThan(0);
});
```

### Data Model

#### New Table: `llm_usage_records`

Stores individual LLM calls (not messages). One run may have many usage records.

```ruby
create_table :llm_usage_records do |t|
  t.references :chat, null: false, foreign_key: true
  t.string :run_id, null: false, index: true    # Groups records from same graph execution
  t.string :graph_name                           # "brainstorm", "website", "ads"

  # Usage
  t.string :model_key, null: false               # NORMALIZED name, e.g., "claude-haiku-4-5"
  t.string :model_raw                            # Raw name from provider for debugging
  t.integer :input_tokens, null: false, default: 0
  t.integer :output_tokens, null: false, default: 0
  t.integer :reasoning_tokens, default: 0        # OpenAI only, included in output_tokens
  t.integer :cache_creation_tokens, default: 0   # Anthropic only
  t.integer :cache_read_tokens, default: 0       # Anthropic only
  t.decimal :cost_usd, precision: 10, scale: 8, null: false

  # Context (from callback metadata/tags)
  t.string :tags, array: true, default: []       # e.g., ["tool:saveAnswers", "notify"]
  t.jsonb :metadata                              # skill, maxTier, etc.

  t.timestamps

  t.index [:chat_id, :run_id]
  t.index :created_at
end
```

#### New Table: `llm_runs` (aggregated per-run summary)

```ruby
create_table :llm_runs do |t|
  t.references :chat, null: false, foreign_key: true
  t.string :run_id, null: false, index: { unique: true }
  t.string :graph_name

  # Aggregated totals
  t.integer :llm_call_count, null: false, default: 0
  t.integer :total_input_tokens, null: false, default: 0
  t.integer :total_output_tokens, null: false, default: 0
  t.decimal :total_cost_usd, precision: 10, scale: 6, null: false
  t.integer :credits_charged, null: false, default: 0

  # Billing
  t.boolean :charged, default: false
  t.datetime :charged_at

  t.timestamps

  t.index [:chat_id, :created_at]
  t.index [:charged, :created_at]
end
```

#### CreditTransaction Reference

```ruby
CreditTransaction.create!(
  account: account,
  transaction_type: "consume",
  credit_type: "plan",  # or "purchased"
  reason: "ai_generation",
  amount: -credits,
  balance_after: new_balance,
  reference: llm_run,  # type: "LlmRun"
  metadata: {
    graph: "brainstorm",
    llm_call_count: 5,
    total_tokens: 12500,
    cost_usd: 0.0234
  }
)
```

### Flow

```
Request comes in (Hono handler)
    ↓
executeWithBilling() called
    ↓
runWithUsageTracking() creates AsyncLocalStorage context
    ↓
graph.invoke(state, { callbacks: [usageTracker, billingCallback] })
    │
    │  ┌─── During Execution ───────────────────────────────────────────┐
    │  │                                                                 │
    │  │  Node calls getLLM() → model with usageTracker attached         │
    │  │      └── model.invoke()                                         │
    │  │          └── handleLLMEnd fires                                 │
    │  │              └── UsageRecord added to AsyncLocalStorage         │
    │  │                                                                 │
    │  │  Tool calls getLLM() internally → same flow                     │
    │  │  Middleware calls getLLM() → same flow                          │
    │  │                                                                 │
    │  └─────────────────────────────────────────────────────────────────┘
    │
    ↓  Graph completes (success or error)
    │
    │  ┌─── billingCallback.handleChainEnd() ───────────────────────────┐
    │  │                                                                 │
    │  │  1. Read UsageRecord[] from AsyncLocalStorage                   │
    │  │  2. POST to Rails: /api/v1/llm_runs                             │
    │  │     - Creates LlmRun with aggregated totals                     │
    │  │     - Bulk inserts LlmUsageRecords for audit                    │
    │  │     - Enqueues Credits::ChargeRunJob                            │
    │  │                                                                 │
    │  └─────────────────────────────────────────────────────────────────┘
    ↓
Result returned to Hono handler (no billing logic here!)
    ↓
    ↓  [Background Job in Rails]
    ↓
Credits::ChargeRunJob:
    1. Load LlmRun (already has totals)
    2. Calculate credits from cost_usd
    3. Create CreditTransaction referencing LlmRun
    4. Mark run as charged: true
```

### Persistence to Rails

```typescript
// langgraph_app/app/core/billing/persistUsage.ts

import { createRailsApiClient } from "@rails_api";
import type { UsageRecord } from "./usageTracker";
import { v4 as uuid } from "uuid";

export async function persistUsageToRails(
  usage: UsageRecord[],
  chatId: number,
  graphName?: string
): Promise<void> {
  if (usage.length === 0) return;

  const runId = uuid();

  // Aggregate totals
  const totals = usage.reduce(
    (acc, r) => ({
      llmCallCount: acc.llmCallCount + 1,
      totalInputTokens: acc.totalInputTokens + r.inputTokens,
      totalOutputTokens: acc.totalOutputTokens + r.outputTokens,
      totalCostUsd: acc.totalCostUsd + r.costUsd,
    }),
    { llmCallCount: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCostUsd: 0 }
  );

  const client = await createRailsApiClient();

  await client.POST("/api/v1/llm_runs", {
    body: {
      llm_run: {
        chat_id: chatId,
        run_id: runId,
        graph_name: graphName,
        ...totals,
      },
      usage_records: usage.map((r) => ({
        model_key: r.normalizedModel,
        model_raw: r.model,
        input_tokens: r.inputTokens,
        output_tokens: r.outputTokens,
        reasoning_tokens: r.reasoningTokens,
        cache_creation_tokens: r.cacheCreationTokens,
        cache_read_tokens: r.cacheReadTokens,
        cost_usd: r.costUsd,
        tags: r.tags,
        metadata: r.metadata,
      })),
    },
  });
}
```

## Edge Cases Handled

| Scenario | How It's Captured |
|----------|-------------------|
| **Agent multi-turn** | `handleLLMEnd` fires for each LLM call in the agent loop |
| **Tool calls LLM internally** | Callback attached via `getLLM()`, fires normally |
| **Middleware calls LLM** | Same - callback attached, captured |
| **Parallel LLM calls** | Each fires independently, all captured to same context |
| **Nested graphs/subgraphs** | AsyncLocalStorage context preserved through async boundaries |
| **LLM called outside tracking** | `getUsageContext()` returns undefined, callback safely no-ops |
| **Streaming** | `handleLLMEnd` still fires at stream completion with full usage |

## Design Decisions

### 1. Charge Granularity: Per-Run (Batch)
- **Decision**: Charge once at end of run, not per-LLM-call
- **Rationale**: Fewer transactions, simpler billing UI, matches user mental model ("I sent one message")
- **Trade-off**: Slightly less granular audit trail (mitigated by storing individual `LlmUsageRecord`s)

### 2. Callback vs Message Detection
- **Decision**: Use LangChain callback system, not message inspection
- **Rationale**: Catches ALL LLM usage (agents, tools, middlewares), not just returned messages
- **Trade-off**: Less visibility into message content (but we have checkpoints for that)

### 3. No Message Content Storage
- **Decision**: Don't store message content in usage records
- **Rationale**: Duplicates checkpoint data, storage cost, privacy concerns
- **Trade-off**: For auditing message content, query checkpoints instead

### 4. Singleton Callback + AsyncLocalStorage
- **Decision**: One callback instance reads from AsyncLocalStorage at invoke time
- **Rationale**: Simple, stateless, no need to thread config through every `getLLM()` call
- **Trade-off**: Requires wrapping graph execution in `runWithUsageTracking()`

### 5. Graph-Level Callbacks for Persistence (Not Hono Handlers)
- **Decision**: Persistence happens in `billingCallback.handleChainEnd()`, not in Hono handler code
- **Rationale**:
  - **Testable**: All graph tests go through `GraphTestBuilder.execute()` which wraps `graph.invoke()`. Adding callbacks there makes billing fully testable.
  - **Self-contained**: Billing logic stays with the graph, not scattered to HTTP handlers
  - **Error handling**: `handleChainError()` ensures we charge for work done even on failures
- **Trade-off**: Two callbacks instead of one, but cleaner separation of concerns

---

## Exploration: Usage Metadata Investigation

**Goal**: Create a test agent that calls tools in sequence, inspect actual usage_metadata structure.

### Test Plan

1. Create simple agent with 2 tools
2. Prompt it to: call tool 1 → wait → call tool 2 → produce final output
3. Log all messages with their usage_metadata
4. Verify assumptions about what has usage and what doesn't

### Expected Message Sequence

```
HumanMessage: "Use tool1 then tool2 to answer X"
    ↓
AIMessage: { tool_calls: [tool1], usage_metadata: {...} }  ← CHARGED
    ↓
ToolMessage: { tool_call_id: "...", content: "result1" }   ← NOT CHARGED
    ↓
AIMessage: { tool_calls: [tool2], usage_metadata: {...} }  ← CHARGED
    ↓
ToolMessage: { tool_call_id: "...", content: "result2" }   ← NOT CHARGED
    ↓
AIMessage: { content: "Final answer", usage_metadata: {...} }  ← CHARGED
```

### Observations

**Verified via `scripts/explore-usage-metadata.ts`** - tested with both OpenAI (gpt-5-mini) and Anthropic (claude-haiku-4-5).

#### 1. Message Sequence Confirmed ✓

The expected sequence was confirmed exactly:
```
HumanMessage (no usage) → AIMessage (usage ✓) → ToolMessage (no usage) → AIMessage (usage ✓) → ToolMessage (no usage) → AIMessage (usage ✓)
```

- **AIMessages with usage_metadata**: 3/3 (100%)
- **ToolMessages with usage_metadata**: 0/2 (0%)

#### 2. Usage Metadata Structure Varies by Provider

**OpenAI (gpt-5-mini)**:
```json
{
  "output_tokens": 88,
  "input_tokens": 299,
  "total_tokens": 387,
  "input_token_details": {
    "audio": 0,
    "cache_read": 0
  },
  "output_token_details": {
    "audio": 0,
    "reasoning": 64
  }
}
```

**Anthropic (claude-haiku-4-5)**:
```json
{
  "input_tokens": 832,
  "output_tokens": 73,
  "total_tokens": 905,
  "input_token_details": {
    "cache_creation": 0,
    "cache_read": 0
  }
}
```

#### 3. Key Differences Between Providers

| Field | OpenAI Location | Anthropic Location |
|-------|-----------------|-------------------|
| Model name | `response_metadata.model_name` | `response_metadata.model` |
| Reasoning tokens | `output_token_details.reasoning` | N/A |
| Cache creation | `cache_creation_input_tokens` | `input_token_details.cache_creation` |
| Cache read | `cache_read_input_tokens` | `input_token_details.cache_read` |

#### 4. Model Name Versioning

Providers return versioned model names that don't match our pricing table:

| Requested | Returned by Provider |
|-----------|---------------------|
| `gpt-5-mini` | `gpt-5-mini-2025-08-07` |
| `claude-haiku-4-5` | `claude-haiku-4-5-20251001` |

**Solution**: Match against known model names using longest-prefix matching:
```typescript
function normalizeModelName(modelName: string): string {
  const knownModels = Object.keys(MODEL_PRICING);
  const matches = knownModels.filter((known) => modelName.startsWith(known));
  if (matches.length > 0) {
    return matches.reduce((longest, current) =>
      current.length > longest.length ? current : longest
    );
  }
  return modelName;
}
```

#### 5. Reasoning Tokens (OpenAI)

OpenAI models report reasoning tokens separately in `output_token_details.reasoning`. These are **included in `output_tokens`**, not additional.

**Cost calculation**:
```typescript
const reasoningTokens = usage.output_token_details?.reasoning || 0;
const nonReasoningOutput = outputTokens - reasoningTokens;

// Charge non-reasoning at output rate, reasoning at reasoning rate
cost += (nonReasoningOutput / 1_000_000) * pricing.cost_out;
cost += (reasoningTokens / 1_000_000) * (pricing.cost_reasoning ?? pricing.cost_out);
```

Langsmith confirmed: reasoning tokens charged at the same rate as output tokens ($2/1M for gpt-5-mini).

#### 6. Cost Calculation Formula

```typescript
cost = (input_tokens / 1M) × cost_in
     + (output_tokens - reasoning_tokens) / 1M × cost_out
     + (reasoning_tokens / 1M) × cost_reasoning
     + (cache_creation_tokens / 1M) × cache_writes    // Anthropic only
     + (cache_read_tokens / 1M) × cache_reads         // Anthropic only
```

#### 7. Validated Against Langsmith

Our cost calculations matched Langsmith exactly:

**OpenAI gpt-5-mini (single message)**:
- Input: 299 tokens × $0.25/1M = $0.000075
- Output: 88 tokens × $2.00/1M = $0.000176
- Reasoning: 64 tokens × $2.00/1M = $0.000128
- **Total: $0.000251** ✓

---

## Implementation Checklist

### Langgraph App

- [ ] **Create `core/billing/usageTracker.ts`**
  - [ ] `UsageRecord` and `UsageContext` types
  - [ ] `usageStorage` AsyncLocalStorage instance
  - [ ] `getUsageContext()` and `runWithUsageTracking()` functions
  - [ ] `UsageTrackingCallbackHandler` class with `handleLLMEnd`
  - [ ] `usageTracker` singleton export
  - [ ] `normalizeModelName()` function (longest-prefix matching)
  - [ ] `calculateCost()` function with pricing table

- [ ] **Create `core/billing/billingCallback.ts`**
  - [ ] `BillingCallbackHandler` class extending `BaseCallbackHandler`
  - [ ] `handleChainEnd()` - persist usage on success
  - [ ] `handleChainError()` - persist usage on error (charge for work done)
  - [ ] `billingCallback` singleton export

- [ ] **Modify `core/llm/llm.ts`**
  - [ ] Import `usageTracker` from billing module
  - [ ] Attach callback in `getLLM()`: `model.withConfig({ callbacks: [usageTracker] })`
  - [ ] Optionally attach metadata (skill, maxTier) for richer audit trail

- [ ] **Create `core/billing/persistUsage.ts`**
  - [ ] `persistUsageToRails()` function
  - [ ] Aggregate totals from UsageRecord[]
  - [ ] POST to Rails API with run + records

- [ ] **Create `core/billing/executeWithBilling.ts`**
  - [ ] `executeWithBilling()` wrapper function
  - [ ] Sets up AsyncLocalStorage context via `runWithUsageTracking()`
  - [ ] Passes both `usageTracker` and `billingCallback` to graph

- [ ] **Update Hono handlers**
  - [ ] Replace `graph.invoke()` with `executeWithBilling()`
  - [ ] No persistence logic in handlers - callbacks handle it

- [ ] **Model name normalization**
  - [ ] Handle `response_metadata.model_name` (OpenAI) vs `response_metadata.model` (Anthropic)
  - [ ] Longest-prefix matching against known model names

- [ ] **Token extraction**
  - [ ] Handle cache tokens in both locations: `cache_*_input_tokens` and `input_token_details.cache_*`
  - [ ] Track reasoning tokens for OpenAI models

- [ ] **Pricing table**
  - [ ] Include `cost_reasoning` for models that support it
  - [ ] Keep in sync with Rails `ModelConfiguration`

### Rails App

- [ ] **Create migrations**
  - [ ] `llm_runs` table
  - [ ] `llm_usage_records` table

- [ ] **Create models**
  - [ ] `LlmRun` model with associations
  - [ ] `LlmUsageRecord` model
  - [ ] Add `has_many :llm_runs` to `Chat`

- [ ] **Create API endpoint**
  - [ ] `POST /api/v1/llm_runs` - accepts run + records in single request
  - [ ] Bulk insert records for efficiency

- [ ] **Create background job**
  - [ ] `Credits::ChargeRunJob` - charges credits for a completed run
  - [ ] Handles credit type selection (plan vs purchased)
  - [ ] Creates `CreditTransaction` referencing the `LlmRun`

- [ ] **Update CreditTransaction**
  - [ ] Ensure polymorphic `reference` supports `LlmRun`

### Testing

- [ ] **Unit tests: `core/billing/usageTracker.ts`**
  - [ ] `UsageTrackingCallback` captures usage correctly
  - [ ] `runWithUsageTracking()` context isolation
  - [ ] Callback no-ops safely outside tracked context
  - [ ] Nested async calls share same context

- [ ] **Unit tests: `core/billing/billingCallback.ts`**
  - [ ] `handleChainEnd()` persists usage on success
  - [ ] `handleChainError()` persists usage on error
  - [ ] No-ops when no usage records exist

- [ ] **Integration tests via GraphTestBuilder**
  - [ ] Add `withBilling()` method to `GraphTestBuilder`
  - [ ] Test agent multi-turn captures all LLM calls
  - [ ] Test tool-internal LLM calls are captured
  - [ ] Test middleware LLM calls are captured
  - [ ] Test cost calculation matches expected values

- [ ] **E2E tests**
  - [ ] Graph execution → Rails persistence → credit charge
  - [ ] Error during graph → usage still persisted

### Existing Resources

- [ ] Test script available at `scripts/explore-usage-metadata.ts` for validation
