# Conversation Traces

## Overview

This document describes how to persist full conversation traces for learning and analytics. This is **separate from billing** (see `langgraph_integration.md`), though they share infrastructure.

**Purpose**: Build a data moat by preserving all conversation data for future learning, fine-tuning, eval development, and prompt optimization.

**Key insight**: Langgraph and Rails share the same Postgres database. Langgraph should write traces directly to Postgres, not route large payloads through Rails HTTP APIs.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Graph Execution                              │
│                                                                      │
│  runWithUsageTracking()                                             │
│      │                                                               │
│      ├── Track new messages (before/after count)                    │
│      ├── Track usage via LLM callback                               │
│      │                                                               │
│      └── On completion:                                              │
│              │                                                       │
│              ├── persistUsageRecords() ──→ llm_usage_records        │
│              ├── persistTrace() ─────────→ conversation_traces      │
│              └── notifyRails(run_id) ────→ Rails charges credits    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Postgres (shared)                            │
│                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                   │
│  │ llm_usage_records   │  │ conversation_traces │                   │
│  │ (billing)           │  │ (learning)          │                   │
│  │                     │  │                     │                   │
│  │ - Small, structured │  │ - Larger, JSONB     │                   │
│  │ - Token counts      │  │ - Full messages     │                   │
│  │ - Cost data         │  │ - Partitioned       │                   │
│  └─────────────────────┘  └─────────────────────┘                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Model

### Per-Run Traces (Not Per-Conversation)

Each run saves **only the new messages from that run**, not the full conversation history:

```
Run 1: User asks question
  → Trace: [HumanMessage, AIMessage]

Run 2: User follows up
  → Trace: [HumanMessage, AIMessage, ToolMessage, AIMessage]

Run 3: Summarization triggers
  → Trace: [SummaryMessage]
```

To reconstruct full conversation:
```sql
SELECT * FROM conversation_traces
WHERE thread_id = ?
ORDER BY created_at
```

**No duplication.** Each message stored exactly once.

### Summarization Safety

Since we capture new messages per-run:

1. Original messages saved in Run N's trace
2. Summarization runs in Run N+1
3. Summary message saved in Run N+1's trace
4. Original messages **still exist** in Run N's trace
5. Nothing lost, even though Langgraph checkpoint was mutated

### Table Schema (Partitioned)

```ruby
# Rails migration
create_table :conversation_traces,
  partition_key: :created_at,
  partition_type: :range do |t|

  t.references :chat, null: false  # No FK constraint for partition drops
  t.string :thread_id, null: false
  t.string :run_id, null: false
  t.string :graph_name

  t.jsonb :messages, null: false   # Serialized BaseMessage[]
  t.jsonb :usage_summary           # { total_cost_usd, llm_call_count, total_tokens }

  t.datetime :created_at, null: false

  t.index [:thread_id, :created_at]
  t.index [:chat_id, :created_at]
  t.index :run_id, unique: true
end
```

**Note**: No foreign key constraint on `chat_id` to allow partition drops without cascading.

### Partition Management

Monthly partitions, created ahead of time:

```ruby
# In migration or setup task
execute <<-SQL
  CREATE TABLE conversation_traces_2026_01
  PARTITION OF conversation_traces
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

  CREATE TABLE conversation_traces_2026_02
  PARTITION OF conversation_traces
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
SQL
```

Monthly job to create next partition and optionally archive old ones:

```ruby
class ManageTracePartitionsJob < ApplicationJob
  def perform
    create_upcoming_partitions
    archive_old_partitions if should_archive?
  end

  private

  def create_upcoming_partitions
    # Create partitions 2 months ahead
    [1, 2].each do |months_ahead|
      month = months_ahead.months.from_now.beginning_of_month
      partition_name = "conversation_traces_#{month.strftime('%Y_%m')}"

      next if partition_exists?(partition_name)

      ActiveRecord::Base.connection.execute(<<-SQL)
        CREATE TABLE #{partition_name}
        PARTITION OF conversation_traces
        FOR VALUES FROM ('#{month}') TO ('#{month + 1.month}')
      SQL
    end
  end

  def archive_old_partitions
    cutoff = 6.months.ago.beginning_of_month
    partition_name = "conversation_traces_#{cutoff.strftime('%Y_%m')}"

    return unless partition_exists?(partition_name)

    # Dump to S3
    system(
      "pg_dump", "-t", partition_name, db_name,
      "|", "gzip",
      "|", "aws", "s3", "cp", "-", "s3://launch10-traces/archive/#{partition_name}.sql.gz"
    )

    # Drop partition (instant, no vacuum)
    ActiveRecord::Base.connection.execute("DROP TABLE #{partition_name}")
  end
end
```

## Implementation

### Langgraph: Persist Trace

```typescript
// langgraph_app/app/core/traces/persistTrace.ts

import { db } from "@db";
import { conversationTraces } from "@db/schema";
import type { BaseMessage } from "@langchain/core/messages";

interface TraceContext {
  chatId: number;
  threadId: string;
  runId: string;
  graphName: string;
}

interface UsageSummary {
  totalCostUsd: number;
  llmCallCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export async function persistTrace(
  context: TraceContext,
  newMessages: BaseMessage[],
  usageSummary: UsageSummary
): Promise<void> {
  if (newMessages.length === 0) return;

  await db.insert(conversationTraces).values({
    chatId: context.chatId,
    threadId: context.threadId,
    runId: context.runId,
    graphName: context.graphName,
    messages: serializeMessages(newMessages),
    usageSummary,
    createdAt: new Date(),
  });
}

function serializeMessages(messages: BaseMessage[]): object[] {
  return messages.map((msg) => ({
    type: msg._getType(),
    content: msg.content,
    name: (msg as any).name,
    tool_calls: (msg as any).tool_calls,
    tool_call_id: (msg as any).tool_call_id,
    usage_metadata: (msg as any).usage_metadata,
    response_metadata: (msg as any).response_metadata,
    id: msg.id,
  }));
}
```

### Langgraph: Integration with Run Wrapper

```typescript
// langgraph_app/app/core/billing/executeWithTracking.ts

import { runWithUsageTracking, type UsageRecord } from "./usageTracker";
import { persistUsageRecords } from "./persistUsage";
import { persistTrace } from "../traces/persistTrace";

interface ExecuteOptions {
  chatId: number;
  threadId: string;
  graphName: string;
  onComplete?: (runId: string) => Promise<void>;
}

export async function executeWithTracking<TState extends { messages?: BaseMessage[] }>(
  graph: CompiledGraph<TState>,
  state: TState,
  config: LangGraphRunnableConfig,
  options: ExecuteOptions
): Promise<TState> {
  const runId = crypto.randomUUID();
  const beforeCount = state.messages?.length ?? 0;

  const { result, usage } = await runWithUsageTracking(
    {
      chatId: options.chatId,
      threadId: options.threadId,
      graphName: options.graphName,
    },
    () => graph.invoke(state, config)
  );

  // Extract new messages
  const newMessages = result.messages?.slice(beforeCount) ?? [];

  // Aggregate usage for summary
  const usageSummary = {
    totalCostUsd: usage.reduce((sum, r) => sum + r.costUsd, 0),
    llmCallCount: usage.length,
    totalInputTokens: usage.reduce((sum, r) => sum + r.inputTokens, 0),
    totalOutputTokens: usage.reduce((sum, r) => sum + r.outputTokens, 0),
  };

  // Write both directly to Postgres (no HTTP to Rails)
  await Promise.all([
    persistUsageRecords(usage, options.chatId, runId, options.graphName),
    persistTrace(
      {
        chatId: options.chatId,
        threadId: options.threadId,
        runId,
        graphName: options.graphName,
      },
      newMessages,
      usageSummary
    ),
  ]);

  // Notify Rails to process billing (just the run_id)
  if (options.onComplete) {
    await options.onComplete(runId);
  }

  return result;
}
```

### Rails: Notify Endpoint

Lightweight endpoint that just enqueues a job:

```ruby
# app/controllers/api/v1/llm_runs_controller.rb

module Api
  module V1
    class LlmRunsController < ApiController
      # POST /api/v1/llm_runs/:run_id/charge
      def charge
        # Data already in Postgres, written by Langgraph
        Credits::ChargeRunJob.perform_later(params[:run_id])
        head :accepted
      end
    end
  end
end
```

### Rails: Model (Read-Only from Rails Perspective)

```ruby
# app/models/conversation_trace.rb

class ConversationTrace < ApplicationRecord
  belongs_to :chat

  # Written by Langgraph, read-only from Rails
  def readonly?
    true
  end

  scope :for_thread, ->(thread_id) { where(thread_id: thread_id).order(:created_at) }
  scope :for_chat, ->(chat_id) { where(chat_id: chat_id).order(:created_at) }

  def messages_parsed
    messages.map { |m| m.with_indifferent_access }
  end
end
```

## Storage Estimates

| Scale | Conversations | Avg Size | Total | Monthly Cost (RDS) |
|-------|---------------|----------|-------|-------------------|
| Year 1 | 1M | 50KB | 50GB | ~$8 |
| Year 2 | 5M | 50KB | 250GB | ~$35 |
| Year 3 | 15M | 50KB | 750GB | ~$100 |

With partitioning and archival to S3, active storage stays bounded.

## Use Cases

Once traces are captured, they enable:

| Use Case | Query Pattern |
|----------|---------------|
| Fine-tuning data | Extract input/output pairs from AI messages |
| Eval development | Sample traces by graph, cost, or outcome |
| Prompt optimization | Compare traces for same graph across time |
| Cost analysis | JOIN traces with usage_summary |
| User research | Reconstruct full conversations |
| Debugging | Find trace by run_id from error logs |

## Relationship to Billing

| Concern | Table | Written By | Used By |
|---------|-------|------------|---------|
| Per-LLM-call costs | `llm_usage_records` | Langgraph | Rails (billing) |
| Per-run aggregates | `llm_runs` | Langgraph | Rails (billing) |
| Credit transactions | `credit_transactions` | Rails | Rails (accounting) |
| Full message history | `conversation_traces` | Langgraph | Analytics/Learning |

The billing system (`langgraph_integration.md`) and trace system are **parallel writes** from the same run completion hook. They share `run_id` for correlation but serve different purposes.

## Implementation Checklist

### Rails

- [ ] Create migration for `conversation_traces` (partitioned)
- [ ] Create initial partitions (current month + 2 ahead)
- [ ] Create `ConversationTrace` model (read-only)
- [ ] Create `ManageTracePartitionsJob` for monthly maintenance
- [ ] Add route for `POST /api/v1/llm_runs/:run_id/charge`

### Langgraph

- [ ] Reflect schema to get `conversationTraces` table in Drizzle
- [ ] Create `persistTrace.ts` with message serialization
- [ ] Update `executeWithTracking` to capture new messages
- [ ] Write trace in parallel with usage records
- [ ] Notify Rails with just `run_id` after writes complete

### Drizzle Schema

After Rails migration, run:
```bash
pnpm run db:reflect
```

This will add `conversationTraces` to the Drizzle schema.

## Future Enhancements

- [ ] Compression for large message arrays (pg_lz4)
- [ ] Sampling for very high-volume graphs
- [ ] Export pipeline to data lake for ML training
- [ ] Trace search/filtering UI in admin panel
