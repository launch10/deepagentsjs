# LangGraph Credit Integration

## Related Plans

- **[conversation_traces.md](./conversation_traces.md)** - Full trace persistence strategy for learning/analytics. The usage tracking callbacks here also capture system prompts for trace completeness.

## Problem

LangGraph agents, tools, and middlewares all call LLMs internally. A node-level approach to billing misses these internal calls because:

1. **Agents** run multiple LLM calls in a loop (tool call → execution → another LLM call), but nodes only return final state
2. **Tools** like `saveAnswersTool` call `getLLM()` directly without returning messages
3. **Middlewares** like `SummarizationMiddleware` use LLMs internally

We need to capture **every** LLM call for accurate billing, regardless of where it happens in the call stack.

## Solution

Use LangChain's callback system at two levels:

1. **LLM-level callback** (`usageTracker`): Attached to every model via `getLLM()`, fires `handleLLMEnd` for each LLM call, accumulates usage and messages to AsyncLocalStorage
2. **Graph-level callback** (`billingCallback`): Passed to `graph.invoke()` or `graph.stream()`, fires `handleChainEnd` when graph completes, persists all accumulated usage to Rails

This approach is testable via the existing `GraphTestBuilder` infrastructure since all graph tests wrap `graph.invoke()`.

### Streaming Support

The callback system works identically for `invoke()`, `stream()`, and `streamEvents()`:
- Callbacks attached at graph level propagate to all nested LLM calls
- `handleChainEnd` fires once after the stream is fully consumed
- Use `!parentRunId` check to ensure we only persist at root level (not nested chains)

## Architecture

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

### Callback Layers

| Callback | Level | Event | Purpose |
|----------|-------|-------|---------|
| `usageTracker` | LLM | `handleLLMEnd` | Accumulate usage for each LLM call |
| `billingCallback` | Graph | `handleChainEnd` | Persist all accumulated usage to Rails |

## Implementation

### 1. Usage Tracker (LLM-Level Callback)

```typescript
// langgraph_app/app/core/billing/usageTracker.ts

import { AsyncLocalStorage } from "node:async_hooks";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { Serialized } from "@langchain/core/load/serializable";
import type { LLMResult } from "@langchain/core/outputs";
import type { AIMessage, BaseMessage } from "@langchain/core/messages";

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

  // System prompt capture (see conversation_traces.md for full trace strategy)
  systemPrompt?: string;
  systemPromptCaptured?: boolean;

  // Message capture for traces (see conversation_traces.md)
  // Pushed via handleLLMEnd - avoids fragile before/after state diffs
  messagesProduced: BaseMessage[];
  userInput?: BaseMessage;  // Set at run start, not from callback
}

const usageStorage = new AsyncLocalStorage<UsageContext>();

export function getUsageContext(): UsageContext | undefined {
  return usageStorage.getStore();
}

export async function runWithUsageTracking<T>(
  context: Partial<UsageContext>,
  fn: () => T | Promise<T>
): Promise<{
  result: T;
  usage: UsageRecord[];
  systemPrompt?: string;
  messagesProduced: BaseMessage[];
}> {
  const fullContext: UsageContext = {
    records: [],
    messagesProduced: [],
    ...context,
  };
  return usageStorage.run(fullContext, async () => {
    const result = await fn();
    return {
      result,
      usage: fullContext.records,
      systemPrompt: fullContext.systemPrompt,
      messagesProduced: fullContext.messagesProduced,
    };
  });
}

class UsageTrackingCallbackHandler extends BaseCallbackHandler {
  name = "usage-tracking";

  /**
   * Capture the system prompt on the first LLM call of a run.
   * This ensures traces have the dynamic system prompt for replay/analysis.
   * See conversation_traces.md for the full trace persistence strategy.
   *
   * NOTE: Use handleChatModelStart (not handleLLMStart) for chat models.
   * - handleLLMStart: Traditional LLMs (string completion), receives prompts: string[]
   * - handleChatModelStart: Chat models (Anthropic, OpenAI chat), receives messages: BaseMessage[][]
   */
  async handleChatModelStart(
    llm: Serialized,
    messages: BaseMessage[][],  // Note: 2D array - messages[0] is the conversation
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const context = getUsageContext();
    if (!context) return;

    // Only capture once per run (system prompt is typically constant)
    if (!context.systemPromptCaptured && messages[0]) {
      const systemMessage = messages[0].find((m) => m._getType() === "system");
      if (systemMessage) {
        context.systemPrompt =
          typeof systemMessage.content === "string"
            ? systemMessage.content
            : JSON.stringify(systemMessage.content);
        context.systemPromptCaptured = true;
      }
    }
  }

  async handleLLMEnd(
    output: LLMResult,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    extraParams?: Record<string, unknown>
  ): Promise<void> {
    const context = getUsageContext();
    if (!context) return; // Not in a tracked context - safe no-op

    for (const generationBatch of output.generations ?? []) {
      for (const generation of generationBatch) {
        const message = (generation as any).message as AIMessage | undefined;
        if (message) {
          // Push message for traces (see conversation_traces.md)
          // This captures all LLM outputs without relying on state diffs
          context.messagesProduced.push(message);

          // Push usage record for billing
          if (message.usage_metadata) {
            const record = this.extractUsageRecord(
              message,
              output.llmOutput,
              runId,
              parentRunId,
              tags,
              extraParams
            );
            context.records.push(record);
          }
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
      usage.input_token_details?.cache_creation ||
      0;
    const cacheReadTokens =
      usage.cache_read_input_tokens ||
      usage.input_token_details?.cache_read ||
      0;

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

export const usageTracker = new UsageTrackingCallbackHandler();
```

### 2. Billing Callback (Graph-Level Persistence)

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
    runId: string,
    parentRunId?: string  // Only persist at root level (no parent)
  ): Promise<void> {
    // Only persist at root level - nested chains shouldn't trigger billing
    if (parentRunId) return;

    const context = getUsageContext();
    if (!context || context.records.length === 0) return;

    await persistUsageToRails(
      context.records,
      context.chatId!,
      context.graphName
    );
  }

  async handleChainError(
    error: Error,
    runId: string,
    parentRunId?: string
  ): Promise<void> {
    // Only persist at root level
    if (parentRunId) return;

    // Still persist usage on error - charge for work done
    const context = getUsageContext();
    if (!context || context.records.length === 0) return;

    await persistUsageToRails(
      context.records,
      context.chatId!,
      context.graphName
    );
  }
}

export const billingCallback = new BillingCallbackHandler();
```

### 3. Modify getLLM to Attach Callback

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

### 4. Graph Execution Wrapper

```typescript
// langgraph_app/app/core/billing/executeWithBilling.ts

import { runWithUsageTracking, usageTracker } from "./usageTracker";
import { billingCallback } from "./billingCallback";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

interface RunOptions {
  chatId: number;
  graphName?: string;
}

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
    () =>
      graph.invoke(input, {
        ...config,
        callbacks: [
          ...(config.callbacks || []),
          usageTracker,
          billingCallback,
        ],
      })
  );

  return result;
}
```

### 5. Usage in Hono Server

```typescript
// In graph invocation handler

const result = await executeWithBilling(
  brainstormGraph,
  state,
  { configurable: { thread_id: threadId } },
  { chatId: chat.id, graphName: "brainstorm" }
);

// Persistence happens in billingCallback.handleChainEnd()
```

### 6. Persistence to Rails

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

### 7. Model Name Normalization

Providers return versioned model names (e.g., `gpt-5-mini-2025-08-07`) that don't match the pricing table. Use longest-prefix matching:

```typescript
// langgraph_app/app/core/billing/pricing.ts

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

### 8. Cost Calculation

```typescript
// langgraph_app/app/core/billing/pricing.ts

interface CostInput {
  model: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

function calculateCost(input: CostInput): number {
  const pricing = MODEL_PRICING[input.model];
  if (!pricing) return 0;

  const nonReasoningOutput = input.outputTokens - input.reasoningTokens;

  let cost = 0;
  cost += (input.inputTokens / 1_000_000) * pricing.cost_in;
  cost += (nonReasoningOutput / 1_000_000) * pricing.cost_out;
  cost += (input.reasoningTokens / 1_000_000) * (pricing.cost_reasoning ?? pricing.cost_out);
  cost += (input.cacheCreationTokens / 1_000_000) * (pricing.cache_writes ?? 0);
  cost += (input.cacheReadTokens / 1_000_000) * (pricing.cache_reads ?? 0);

  return cost;
}
```

## Data Model

### llm_runs (Rails)

Aggregated per-run summary for billing.

```ruby
create_table :llm_runs do |t|
  t.references :chat, null: false, foreign_key: true
  t.string :run_id, null: false, index: { unique: true }
  t.string :graph_name

  t.integer :llm_call_count, null: false, default: 0
  t.integer :total_input_tokens, null: false, default: 0
  t.integer :total_output_tokens, null: false, default: 0
  t.decimal :total_cost_usd, precision: 10, scale: 6, null: false
  t.integer :credits_charged, null: false, default: 0

  t.boolean :charged, default: false
  t.datetime :charged_at

  t.timestamps

  t.index [:chat_id, :created_at]
  t.index [:charged, :created_at]
end
```

### llm_usage_records (Rails)

Individual LLM calls for audit trail.

```ruby
create_table :llm_usage_records do |t|
  t.references :chat, null: false, foreign_key: true
  t.string :run_id, null: false, index: true
  t.string :graph_name

  t.string :model_key, null: false
  t.string :model_raw
  t.integer :input_tokens, null: false, default: 0
  t.integer :output_tokens, null: false, default: 0
  t.integer :reasoning_tokens, default: 0
  t.integer :cache_creation_tokens, default: 0
  t.integer :cache_read_tokens, default: 0
  t.decimal :cost_usd, precision: 10, scale: 8, null: false

  t.string :tags, array: true, default: []
  t.jsonb :metadata

  t.timestamps

  t.index [:chat_id, :run_id]
  t.index :created_at
end
```

### CreditTransaction Reference

```ruby
CreditTransaction.create!(
  account: account,
  transaction_type: "consume",
  credit_type: "plan",
  reason: "ai_generation",
  amount: -credits,
  balance_after: new_balance,
  reference: llm_run,
  metadata: {
    graph: "brainstorm",
    llm_call_count: 5,
    total_tokens: 12500,
    cost_usd: 0.0234
  }
)
```

## Request Flow

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
Result returned to Hono handler
    ↓
    ↓  [Background Job in Rails]
    ↓
Credits::ChargeRunJob:
    1. Load LlmRun (already has totals)
    2. Calculate credits from cost_usd
    3. Create CreditTransaction referencing LlmRun
    4. Mark run as charged: true
```

## Testing

Add a `withBilling()` method to `GraphTestBuilder`:

```typescript
// tests/support/graph/graphTester.ts

class GraphTestBuilder<TGraphState extends CoreGraphState> {
  private billingEnabled = false;

  withBilling(): GraphTestBuilder<TGraphState> {
    this.billingEnabled = true;
    return this;
  }

  async execute(): Promise<NodeTestResult<TGraphState>> {
    // ... existing setup ...

    if (this.billingEnabled) {
      const { result } = await runWithUsageTracking(
        { chatId: this.initialState.chatId, graphName: this.graph?.name },
        () =>
          testGraph.invoke(initialState, {
            ...invokeConfig,
            callbacks: [usageTracker, billingCallback],
          })
      );
      // ... handle result ...
    } else {
      const result = await testGraph.invoke(initialState, invokeConfig);
      // ...
    }
  }
}
```

Example test:

```typescript
it("tracks usage for brainstorm agent", async () => {
  const result = await testGraph()
    .withGraph(brainstormGraph)
    .withPrompt("Help me brainstorm ideas for a dog walking app")
    .withBilling()
    .execute();

  const context = getUsageContext();
  expect(context?.records.length).toBeGreaterThan(0);

  const totalCost = context?.records.reduce((sum, r) => sum + r.costUsd, 0);
  expect(totalCost).toBeGreaterThan(0);
});
```

## Provider-Specific Notes

### Usage Metadata Location

| Field | OpenAI | Anthropic |
|-------|--------|-----------|
| Model name | `response_metadata.model_name` | `response_metadata.model` |
| Reasoning tokens | `output_token_details.reasoning` | N/A |
| Cache creation | `cache_creation_input_tokens` | `input_token_details.cache_creation` |
| Cache read | `cache_read_input_tokens` | `input_token_details.cache_read` |

### Reasoning Tokens (OpenAI)

OpenAI models report reasoning tokens in `output_token_details.reasoning`. These are **included in `output_tokens`**, not additional. Charge non-reasoning at output rate, reasoning at reasoning rate.

## Edge Cases

| Scenario | How It's Handled |
|----------|------------------|
| Agent multi-turn | `handleLLMEnd` fires for each LLM call in the loop |
| Tool calls LLM internally | Callback attached via `getLLM()`, fires normally |
| Middleware calls LLM | Same - callback attached, captured |
| Parallel LLM calls | Each fires independently, all captured to same context |
| Nested graphs/subgraphs | AsyncLocalStorage context preserved through async boundaries |
| LLM called outside tracking | `getUsageContext()` returns undefined, callback safely no-ops |
| Graph errors | `handleChainError()` still persists usage |

## Implementation Checklist

### LangGraph App

- [ ] Create `core/billing/usageTracker.ts`
  - [ ] `UsageRecord` and `UsageContext` types (including `systemPrompt` fields)
  - [ ] `usageStorage` AsyncLocalStorage instance
  - [ ] `getUsageContext()` and `runWithUsageTracking()` functions
  - [ ] `UsageTrackingCallbackHandler` class with:
    - [ ] `handleLLMStart` - captures system prompt on first LLM call
    - [ ] `handleLLMEnd` - accumulates usage records
  - [ ] `usageTracker` singleton export

- [ ] Create `core/billing/billingCallback.ts`
  - [ ] `BillingCallbackHandler` class with `handleChainEnd` and `handleChainError`
  - [ ] `billingCallback` singleton export

- [ ] Create `core/billing/pricing.ts`
  - [ ] `normalizeModelName()` function (longest-prefix matching)
  - [ ] `calculateCost()` function
  - [ ] `MODEL_PRICING` table (keep in sync with Rails)

- [ ] Create `core/billing/persistUsage.ts`
  - [ ] `persistUsageToRails()` function

- [ ] Create `core/billing/executeWithBilling.ts`
  - [ ] `executeWithBilling()` wrapper function

- [ ] Modify `core/llm/llm.ts`
  - [ ] Attach `usageTracker` callback in `getLLM()`

- [ ] Update Hono handlers
  - [ ] Replace `graph.invoke()` with `executeWithBilling()`

### Rails App

- [ ] Create migrations
  - [ ] `llm_runs` table
  - [ ] `llm_usage_records` table

- [ ] Create models
  - [ ] `LlmRun` model
  - [ ] `LlmUsageRecord` model
  - [ ] Add `has_many :llm_runs` to `Chat`

- [ ] Create API endpoint
  - [ ] `POST /api/v1/llm_runs` (accepts run + records)

- [ ] Create background job
  - [ ] `Credits::ChargeRunJob`

### Testing

- [ ] Unit tests for `usageTracker`
- [ ] Unit tests for `billingCallback`
- [ ] Add `withBilling()` to `GraphTestBuilder`
- [ ] Integration tests via `testGraph().withBilling()`
- [ ] E2E: graph execution → Rails persistence → credit charge

### Validation Script

Test script available at `scripts/explore-usage-metadata.ts` for validating usage metadata extraction across providers.
