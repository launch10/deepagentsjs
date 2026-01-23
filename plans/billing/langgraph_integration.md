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
2. **Execution wrapper** (`executeWithTracking`): Wraps `graph.invoke()`, writes accumulated usage and traces directly to Postgres after graph completes

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
│  executeWithTracking() wraps graph.invoke()                                   │
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
│  │              │   → accumulates messages      │                          │  │
│  │              └───────────────────────────────┘                          │  │
│  │                                                                          │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  Graph completes → executeWithTracking() writes to Postgres:                  │
│     - llm_usage_records (for billing)                                         │
│     - conversation_traces (for analytics)                                     │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

                              │
                              ▼

┌───────────────────────────────────────────────────────────────────────────────┐
│                    Rails Background Workers                                   │
│                                                                               │
│  Credits::ChargeRunWorker (triggered by POST /api/v1/llm_usage/notify)        │
│    1. Find unprocessed llm_usage_records for run_id (processed_at IS NULL)    │
│    2. Aggregate cost_usd for the run                                          │
│    3. Convert cost → credits                                                  │
│    4. Create CreditTransaction (reference_type: "llm_run", reference_id: UUID)│
│    5. Mark records processed_at = NOW                                         │
│                                                                               │
│  Credits::FindUnprocessedRunsWorker (backup polling, every minute)            │
│    1. Find run_ids with unprocessed records older than 2 minutes              │
│    2. Enqueue ChargeRunWorker for each stale run_id                           │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Callback Layer

| Callback       | Level | Event                  | Purpose                               |
| -------------- | ----- | ---------------------- | ------------------------------------- |
| `usageTracker` | LLM   | `handleChatModelStart` | Capture system prompt                 |
| `usageTracker` | LLM   | `handleLLMEnd`         | Accumulate usage records and messages |

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
  userInput?: BaseMessage; // Set at run start, not from callback
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
    messages: BaseMessage[][], // Note: 2D array - messages[0] is the conversation
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
      usage.cache_creation_input_tokens || usage.input_token_details?.cache_creation || 0;
    const cacheReadTokens =
      usage.cache_read_input_tokens || usage.input_token_details?.cache_read || 0;

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

### 2. No Billing Callback Needed

With the simplified architecture, we **don't need a separate billing callback**. Persistence happens in `executeWithTracking()` after the graph completes, not in a callback.

The `usageTracker` callback accumulates records to AsyncLocalStorage, and `executeWithTracking()` reads them after the graph finishes and writes directly to Postgres.

This is simpler and more explicit - no magic callbacks, just:

1. Run graph with usage tracking
2. Write results to database
3. Return to caller

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

See `conversation_traces.md` for the full `executeWithTracking` implementation. Key points:

- Wraps `runWithUsageTracking()` to set up AsyncLocalStorage context
- Writes both `llm_usage_records` and `conversation_traces` to Postgres after graph completes
- No HTTP calls to Rails - direct database writes

```typescript
// langgraph_app/app/core/billing/executeWithTracking.ts

import { runWithUsageTracking } from "./usageTracker";
import { persistUsageRecords } from "./persistUsage";
import { persistTrace } from "../traces/persistTrace";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

interface ExecuteOptions {
  chatId: number;
  threadId: string;
  graphName: string;
  userInput?: BaseMessage;
}

export async function executeWithTracking<TState extends { messages?: BaseMessage[] }>(
  graph: CompiledGraph<TState>,
  state: TState,
  config: LangGraphRunnableConfig,
  options: ExecuteOptions
): Promise<TState> {
  const runId = crypto.randomUUID();

  const { result, usage, systemPrompt, messagesProduced } = await runWithUsageTracking(
    {
      chatId: options.chatId,
      threadId: options.threadId,
      graphName: options.graphName,
    },
    () => graph.invoke(state, config)
  );

  // Write both tables directly to Postgres (no HTTP to Rails)
  await Promise.all([
    persistUsageRecords(usage, options.chatId, runId, options.graphName),
    persistTrace(
      {
        chatId: options.chatId,
        threadId: options.threadId,
        runId,
        graphName: options.graphName,
        systemPrompt,
      },
      [options.userInput, ...messagesProduced].filter(Boolean) as BaseMessage[],
      aggregateUsage(usage)
    ),
  ]);

  return result;
}
```

### 5. Usage in Hono Server

```typescript
// In graph invocation handler

const result = await executeWithTracking(
  brainstormGraph,
  state,
  { configurable: { thread_id: threadId } },
  {
    chatId: chat.id,
    threadId,
    graphName: "brainstorm",
    userInput: state.messages?.at(-1), // The user's message
  }
);

// Persistence happened synchronously before returning
// Rails job will process credits in the background
```

### 6. Persistence to Postgres (Direct Write)

Langgraph writes directly to the shared Postgres database - no HTTP call to Rails.

```typescript
// langgraph_app/app/core/billing/persistUsage.ts

import { db } from "@db";
import { llmUsageRecords } from "@db/schema";
import type { UsageRecord } from "./usageTracker";

export async function persistUsageRecords(
  usage: UsageRecord[],
  chatId: number,
  runId: string,
  graphName?: string
): Promise<void> {
  if (usage.length === 0) return;

  await db.insert(llmUsageRecords).values(
    usage.map((r) => ({
      chatId,
      runId,
      graphName,
      modelKey: r.normalizedModel,
      modelRaw: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      reasoningTokens: r.reasoningTokens,
      cacheCreationTokens: r.cacheCreationTokens,
      cacheReadTokens: r.cacheReadTokens,
      costUsd: r.costUsd,
      tags: r.tags,
      metadata: r.metadata,
      // processedAt: NULL - Rails job will set this when charged
    }))
  );
}
```

### 6b. Rails API Endpoint (Notify)

Langgraph calls this endpoint after writing to Postgres. Rails enqueues a job to process the run.

```ruby
# app/controllers/api/v1/llm_usage_controller.rb

module Api
  module V1
    class LlmUsageController < ApiController
      # POST /api/v1/llm_usage/notify
      # Called by Langgraph after writing llm_usage_records to Postgres
      #
      # Parameters:
      #   run_id: string (required) - UUID of the run to process
      #
      # Response:
      #   202 Accepted - Job enqueued
      #   422 Unprocessable Entity - Missing run_id
      def notify
        run_id = params.require(:run_id)

        # Enqueue job to process this specific run
        Credits::ChargeRunJob.perform_later(run_id)

        head :accepted
      end
    end
  end
end
```

```ruby
# config/routes.rb
namespace :api do
  namespace :v1 do
    post "llm_usage/notify", to: "llm_usage#notify"
  end
end
```

### 6c. Langgraph: Call Notify API

After writing to Postgres, notify Rails:

```typescript
// langgraph_app/app/core/billing/notifyRails.ts

import { createRailsApiClient } from "@rails_api";

export async function notifyRailsUsage(runId: string): Promise<void> {
  try {
    const client = await createRailsApiClient();
    await client.POST("/api/v1/llm_usage/notify", {
      body: { run_id: runId },
    });
  } catch (error) {
    // Log but don't throw - backup polling will catch it
    console.error(`Failed to notify Rails for run ${runId}:`, error);
  }
}
```

Update `executeWithTracking` to call this:

```typescript
// In executeWithTracking, after Postgres writes:
await Promise.all([
  persistUsageRecords(usage, options.chatId, runId, options.graphName),
  persistTrace(...),
]);

// Notify Rails (fire-and-forget, backup polling exists)
notifyRailsUsage(runId);

return result;
```

### 6d. Rails Job: Charge Run (Primary)

Processes a specific run_id. Idempotent - safe to call multiple times.

```ruby
# app/jobs/credits/charge_run_job.rb

module Credits
  class ChargeRunJob < ApplicationJob
    queue_as :billing

    def perform(run_id)
      # Idempotent: skip if already processed
      return if LlmUsageRecord.where(run_id: run_id).where.not(processed_at: nil).exists?

      records = LlmUsageRecord.where(run_id: run_id, processed_at: nil)
      return if records.empty?

      # Aggregate usage for this run
      run_summary = records.select(
        "MIN(chat_id) as chat_id",
        "MIN(graph_name) as graph_name",
        "SUM(cost_usd) as total_cost_usd",
        "COUNT(*) as llm_call_count",
        "SUM(input_tokens) as total_input_tokens",
        "SUM(output_tokens) as total_output_tokens"
      ).first

      chat = Chat.find(run_summary.chat_id)
      account = chat.project.account
      credits = convert_cost_to_credits(run_summary.total_cost_usd)

      ApplicationRecord.transaction do
        CreditTransaction.create!(
          account: account,
          transaction_type: "consume",
          credit_type: "plan",
          reason: "ai_generation",
          amount: -credits,
          balance_after: account.credit_balance - credits,
          reference_type: "llm_run",
          reference_id: run_id,
          metadata: {
            graph_name: run_summary.graph_name,
            llm_call_count: run_summary.llm_call_count,
            total_tokens: run_summary.total_input_tokens + run_summary.total_output_tokens,
            cost_usd: run_summary.total_cost_usd.to_f
          }
        )

        account.decrement!(:credit_balance, credits)

        # Mark all records for this run as processed
        records.update_all(processed_at: Time.current)
      end
    end

    private

    def convert_cost_to_credits(cost_usd)
      # $0.01 = 1 credit (example conversion rate)
      (cost_usd * 100).ceil
    end
  end
end
```

### 6e. Rails Job: Backup Polling (Catch Missed)

Safety net for any records that didn't get processed (API call failed, job failed, etc.).

```ruby
# app/jobs/credits/find_unprocessed_runs_job.rb

module Credits
  class FindUnprocessedRunsJob < ApplicationJob
    queue_as :billing

    STALE_THRESHOLD = 2.minutes

    def perform
      # Find run_ids where records are unprocessed and older than threshold
      # This catches any runs where the API notification failed
      stale_run_ids = LlmUsageRecord
        .where(processed_at: nil)
        .where("created_at < ?", STALE_THRESHOLD.ago)
        .distinct
        .pluck(:run_id)

      stale_run_ids.each do |run_id|
        # Enqueue each run separately - idempotent, safe to re-enqueue
        ChargeRunJob.perform_later(run_id)
      end

      Rails.logger.info("[FindUnprocessedRunsJob] Enqueued #{stale_run_ids.count} stale runs")
    end
  end
end
```

Schedule with Zhong (schedule.rb):

```ruby
every(1.minute, "find unprocessed llm usage") do
  Credits::FindUnprocessedRunsJob.perform_async
end
```

### Billing Flow Summary

```
Langgraph completes graph execution
    │
    ├── 1. Write llm_usage_records to Postgres (processed_at = NULL)
    ├── 2. Write conversation_traces to Postgres
    └── 3. POST /api/v1/llm_usage/notify { run_id }
                │
                ▼
        Rails enqueues ChargeRunJob(run_id)
                │
                ▼
        ChargeRunJob processes run:
          - Aggregate cost_usd
          - Create CreditTransaction
          - Mark records processed_at = NOW

[Backup: Every minute]
        │
        ▼
FindUnprocessedRunsJob:
  - Find records WHERE processed_at IS NULL AND created_at < 2 minutes ago
  - Enqueue ChargeRunJob for each stale run_id
  - Idempotent: ChargeRunJob skips already-processed runs
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

### Simplified Architecture

There is **no `llm_runs` table**. The `run_id` is just a UUID that groups related records together:

```
conversation_traces.run_id ←→ llm_usage_records.run_id ←→ credit_transactions (via reference_id)
```

- **Langgraph** writes directly to Postgres (no HTTP to Rails)
- **Rails** owns credit conversion via a periodic background job
- **`processed_at`** on usage records tracks what's been billed

### llm_usage_records

Individual LLM calls, written directly by Langgraph to shared Postgres.

```ruby
create_table :llm_usage_records do |t|
  t.references :chat, null: false  # No FK constraint for Langgraph writes
  t.string :run_id, null: false
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

  t.datetime :processed_at  # NULL = not yet charged, set by Rails job

  t.timestamps

  t.index :run_id
  t.index [:chat_id, :run_id]
  t.index [:processed_at, :created_at]  # For finding unprocessed records
end
```

### CreditTransaction Reference

Rails job creates transactions referencing the `run_id`:

```ruby
CreditTransaction.create!(
  account: account,
  transaction_type: "consume",
  credit_type: "plan",
  reason: "ai_generation",
  amount: -credits,
  balance_after: new_balance,
  reference_type: "llm_run",
  reference_id: run_id,  # UUID string, not a model ID
  metadata: {
    graph_name: "brainstorm",
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
executeWithTracking() called
    ↓
runWithUsageTracking() creates AsyncLocalStorage context
    ↓
graph.invoke(state, { callbacks: [usageTracker] })
    │
    │  ┌─── During Execution ───────────────────────────────────────────┐
    │  │                                                                 │
    │  │  Node calls getLLM() → model with usageTracker attached         │
    │  │      └── model.invoke()                                         │
    │  │          └── handleLLMEnd fires                                 │
    │  │              └── UsageRecord added to AsyncLocalStorage         │
    │  │              └── Message added to messagesProduced              │
    │  │                                                                 │
    │  │  Tool calls getLLM() internally → same flow                     │
    │  │  Middleware calls getLLM() → same flow                          │
    │  │                                                                 │
    │  └─────────────────────────────────────────────────────────────────┘
    │
    ↓  Graph completes (success or error)
    │
    │  ┌─── executeWithTracking() completion ───────────────────────────┐
    │  │                                                                 │
    │  │  1. Read usage[], messagesProduced, systemPrompt from context   │
    │  │  2. Write directly to Postgres (shared with Rails):             │
    │  │     - INSERT llm_usage_records (processed_at = NULL)            │
    │  │     - INSERT conversation_traces                                │
    │  │  3. POST /api/v1/llm_usage/notify { run_id }                    │
    │  │                                                                 │
    │  └─────────────────────────────────────────────────────────────────┘
    ↓
Result returned to Hono handler
    │
    │  [Rails receives notify]
    │      ↓
    │  Enqueues Credits::ChargeRunJob(run_id)
    │      ↓
    │  Job processes run:
    │    - Aggregate cost_usd for run_id
    │    - Create CreditTransaction
    │    - Mark records processed_at = NOW
    │
    │  [Backup: Every minute]
    │      ↓
    │  Credits::FindUnprocessedRunsJob:
    │    - Find records WHERE processed_at IS NULL AND created_at < 2 min ago
    │    - Enqueue ChargeRunJob for each stale run_id
    │    - Idempotent: ChargeRunJob skips already-processed runs
```

## Testing

Add a `withTracking()` method to `GraphTestBuilder`:

```typescript
// tests/support/graph/graphTester.ts

class GraphTestBuilder<TGraphState extends CoreGraphState> {
  private trackingEnabled = false;
  private trackingResult?: {
    usage: UsageRecord[];
    messagesProduced: BaseMessage[];
    systemPrompt?: string;
  };

  withTracking(): GraphTestBuilder<TGraphState> {
    this.trackingEnabled = true;
    return this;
  }

  async execute(): Promise<NodeTestResult<TGraphState>> {
    // ... existing setup ...

    if (this.trackingEnabled) {
      const { result, usage, messagesProduced, systemPrompt } = await runWithUsageTracking(
        { chatId: this.initialState.chatId, graphName: this.graph?.name },
        () => testGraph.invoke(initialState, invokeConfig)
      );
      this.trackingResult = { usage, messagesProduced, systemPrompt };
      // ... handle result ...
    } else {
      const result = await testGraph.invoke(initialState, invokeConfig);
      // ...
    }
  }

  getTrackingResult() {
    return this.trackingResult;
  }
}
```

Example test:

```typescript
it("tracks usage for brainstorm agent", async () => {
  const builder = testGraph()
    .withGraph(brainstormGraph)
    .withPrompt("Help me brainstorm ideas for a dog walking app")
    .withTracking();

  await builder.execute();

  const tracking = builder.getTrackingResult();
  expect(tracking?.usage.length).toBeGreaterThan(0);

  const totalCost = tracking?.usage.reduce((sum, r) => sum + r.costUsd, 0);
  expect(totalCost).toBeGreaterThan(0);

  // Also verify messages and system prompt captured
  expect(tracking?.messagesProduced.length).toBeGreaterThan(0);
  expect(tracking?.systemPrompt).toBeDefined();
});
```

## Provider-Specific Notes

### Usage Metadata Location

| Field            | OpenAI                           | Anthropic                            |
| ---------------- | -------------------------------- | ------------------------------------ |
| Model name       | `response_metadata.model_name`   | `response_metadata.model`            |
| Reasoning tokens | `output_token_details.reasoning` | N/A                                  |
| Cache creation   | `cache_creation_input_tokens`    | `input_token_details.cache_creation` |
| Cache read       | `cache_read_input_tokens`        | `input_token_details.cache_read`     |

### Reasoning Tokens (OpenAI)

OpenAI models report reasoning tokens in `output_token_details.reasoning`. These are **included in `output_tokens`**, not additional. Charge non-reasoning at output rate, reasoning at reasoning rate.

## Edge Cases

| Scenario                    | How It's Handled                                              |
| --------------------------- | ------------------------------------------------------------- |
| Agent multi-turn            | `handleLLMEnd` fires for each LLM call in the loop            |
| Tool calls LLM internally   | Callback attached via `getLLM()`, fires normally              |
| Middleware calls LLM        | Same - callback attached, captured                            |
| Parallel LLM calls          | Each fires independently, all captured to same context        |
| Nested graphs/subgraphs     | AsyncLocalStorage context preserved through async boundaries  |
| LLM called outside tracking | `getUsageContext()` returns undefined, callback safely no-ops |
| Graph errors                | Still writes to Postgres, still notifies Rails                |
| API notification fails      | Backup polling job catches stale records after 2 minutes      |
| ChargeRunJob fails          | Records remain unprocessed, backup job re-enqueues            |

## Implementation Checklist

### LangGraph App

- [ ] Create `core/billing/usageTracker.ts`
  - [ ] `UsageRecord` and `UsageContext` types (including `systemPrompt`, `messagesProduced`)
  - [ ] `usageStorage` AsyncLocalStorage instance
  - [ ] `getUsageContext()` and `runWithUsageTracking()` functions
  - [ ] `UsageTrackingCallbackHandler` class with:
    - [ ] `handleChatModelStart` - captures system prompt on first LLM call
    - [ ] `handleLLMEnd` - accumulates usage records and messages
  - [ ] `usageTracker` singleton export

- [ ] Create `core/billing/pricing.ts`
  - [ ] `normalizeModelName()` function (longest-prefix matching)
  - [ ] `calculateCost()` function
  - [ ] `MODEL_PRICING` table

- [ ] Create `core/billing/persistUsage.ts`
  - [ ] `persistUsageRecords()` - writes directly to Postgres

- [ ] Create `core/billing/notifyRails.ts`
  - [ ] `notifyRailsUsage(runId)` - POST to Rails API (fire-and-forget)

- [ ] Create `core/billing/executeWithTracking.ts`
  - [ ] `executeWithTracking()` wrapper function
  - [ ] Writes both `llm_usage_records` and `conversation_traces`
  - [ ] Calls `notifyRailsUsage(runId)` after writes

- [ ] Modify `core/llm/llm.ts`
  - [ ] Attach `usageTracker` callback in `getLLM()`

- [ ] Update Hono handlers
  - [ ] Replace `graph.invoke()` with `executeWithTracking()`

### Rails App

- [ ] Create migration for `llm_usage_records` table
  - [ ] Include `processed_at` column for job tracking
  - [ ] Index on `[:processed_at, :created_at]` for job queries
  - [ ] Index on `run_id` for job lookups

- [ ] Create `LlmUsageRecord` model
  - [ ] `belongs_to :chat`
  - [ ] Scopes: `unprocessed`, `for_run`

- [ ] Create API endpoint `POST /api/v1/llm_usage/notify`
  - [ ] `Api::V1::LlmUsageController#notify`
  - [ ] Receives `run_id`, enqueues `ChargeRunJob`

- [ ] Create `Credits::ChargeRunJob`
  - [ ] Process a specific `run_id`
  - [ ] Idempotent (skip if already processed)
  - [ ] Aggregate `cost_usd` for run
  - [ ] Create `CreditTransaction` with `reference_id: run_id`
  - [ ] Mark records `processed_at = NOW`

- [ ] Create `Credits::FindUnprocessedRunsJob` (backup)
  - [ ] Find records WHERE `processed_at IS NULL AND created_at < 2 minutes ago`
  - [ ] Enqueue `ChargeRunJob` for each stale `run_id`

- [ ] Schedule backup job (Zhong/Sidekiq-Cron)
  - [ ] Run every minute

### Testing

- [ ] Unit tests for `usageTracker`
- [ ] Unit tests for `persistUsageRecords`
- [ ] Add `withTracking()` to `GraphTestBuilder`
- [ ] Integration tests via `testGraph().withTracking()`
- [ ] E2E: graph execution → Postgres write → Rails job → credit charge

### Validation Script

Test script available at `scripts/explore-usage-metadata.ts` for validating usage metadata extraction across providers.
