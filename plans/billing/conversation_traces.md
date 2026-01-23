# Conversation Traces

## Overview

This document describes how to persist full conversation traces for learning and analytics. This is **separate from billing** (see `langgraph_integration.md`), though they share infrastructure.

**Purpose**: Build a data moat by preserving all conversation data for future learning, fine-tuning, eval development, and prompt optimization.

**Key insights**:
1. Langgraph and Rails share the same Postgres database. Langgraph should write traces directly to Postgres, not route large payloads through Rails HTTP APIs.
2. Context messages (system-injected context for the LLM) should be stored in state.messages and filtered at the SDK layer, not before saving. This preserves full context for analytics while hiding implementation details from users.
3. Dynamic system prompts should be captured at the LLM callback level for trace completeness.

---

## Key Benefits

| Benefit | How |
|---------|-----|
| **LLM sees full context across runs** | Context messages stay in state.messages |
| **Users see clean conversation** | SDK filters context messages before display |
| **Full analytics/replay capability** | Traces include everything: messages, context, system prompt |
| **Summarization-safe** | Messages captured via `handleLLMEnd`, not state diffs |
| **System prompt versioning** | Captured at callback level, stored in traces |
| **Shared infrastructure** | Same callbacks power both billing and traces |

---

## Context Messages

### The Problem

Previously, "pseudo messages" were filtered out before saving to state:

```typescript
// OLD: Data lost forever
const filteredMessages = filterPseudoMessages(messages);
return { messages: filteredMessages };
```

This caused two problems:
1. **Lost analytics data** - Can't understand what context the LLM had
2. **Lost conversation continuity** - LLM only sees context message once, then forgets

### The Solution: Filter in SDK, Not State

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Message Flow                                 │
│                                                                      │
│  Node creates ContextMessage                                        │
│      │                                                               │
│      ▼                                                               │
│  state.messages includes ContextMessage  ← Stored for analytics     │
│      │                                                               │
│      ▼                                                               │
│  LanggraphAISDK filters ContextMessage   ← Hidden from UI           │
│      │                                                               │
│      ▼                                                               │
│  User sees clean conversation                                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### ContextMessage Implementation

Use LangChain's built-in `name` field to mark context messages:

```typescript
// langgraph_app/app/utils/contextMessages.ts

import { HumanMessage, type BaseMessage, type MessageContent } from "@langchain/core/messages";

/**
 * Context messages are visible to the model but hidden from the user.
 * They're stored in state.messages and filtered during SDK translation.
 *
 * Benefits:
 * - LLM sees context across all runs (not just the run it was injected)
 * - Full context preserved in traces for analytics/replay
 * - Clean separation: state is truth, SDK is presentation
 */
export const CONTEXT_MESSAGE_NAME = "context";

export const isContextMessage = (msg: BaseMessage): boolean => {
  return (msg as any).name === CONTEXT_MESSAGE_NAME;
};

export const createContextMessage = (
  content: string,
  metadata?: Record<string, unknown>
): HumanMessage => {
  return new HumanMessage({
    content,
    name: CONTEXT_MESSAGE_NAME,
    additional_kwargs: {
      context_type: "system_injected",
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  });
};

export const createMultimodalContextMessage = (
  content: MessageContent,
  metadata?: Record<string, unknown>
): HumanMessage => {
  return new HumanMessage({
    content,
    name: CONTEXT_MESSAGE_NAME,
    additional_kwargs: {
      context_type: "system_injected",
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  });
};
```

### Migration from PseudoMessages

| Old Pattern | New Pattern |
|-------------|-------------|
| `createPseudoMessage(text)` | `createContextMessage(text)` |
| `createMultimodalPseudoMessage(content)` | `createMultimodalContextMessage(content)` |
| `isPseudoMessage(msg)` | `isContextMessage(msg)` |
| `filterPseudoMessages(messages)` | Remove entirely - don't filter in nodes |

### Node Changes

```typescript
// BEFORE: brainstorm/agent.ts
const filteredMessages = filterPseudoMessages(messages as BaseMessage[]);
return {
  messages: filteredMessages,  // ❌ Lost context
  ...
};

// AFTER: brainstorm/agent.ts
return {
  messages,  // ✅ Keep everything, including context messages
  ...
};
```

### LanggraphAISDK Changes

Filter context messages during translation to UI format:

```typescript
// packages/langgraph-ai-sdk/packages/langgraph-ai-sdk/src/contextMessages.ts

import type { BaseMessage } from "@langchain/core/messages";

export const CONTEXT_MESSAGE_NAME = "context";

export const isContextMessage = (msg: BaseMessage): boolean => {
  return (msg as any).name === CONTEXT_MESSAGE_NAME;
};
```

```typescript
// packages/langgraph-ai-sdk/packages/langgraph-ai-sdk/src/stream.ts

import { isContextMessage } from "./contextMessages";

// In loadThreadHistory:
export async function loadThreadHistory<...>(...) {
  ...
  const messages = (stateSnapshot.values.messages as BaseMessage[]) || [];

  // Filter context messages before translating to UI
  const visibleMessages = messages.filter(msg => !isContextMessage(msg));

  const uiMessages = visibleMessages.map((msg, idx) => {
    ...
  });

  return { messages: uiMessages, state: globalState };
}

// In RawMessageHandler.handle():
async handle(chunk: StreamChunk): Promise<void> {
  ...
  const [message, metadata] = data as StreamMessageOutput;

  // Skip context messages during streaming
  if (isContextMessage(message)) return;

  ...
}
```

---

## System Prompt Capture

Dynamic system prompts are injected via middleware at LLM call time, not stored in state.messages. To preserve them for traces, we capture at the callback level.

### Callback Enhancement

Use `handleChatModelStart` (not `handleLLMStart`) for chat models. See `langgraph_integration.md` for the authoritative implementation.

```typescript
// In UsageTrackingCallback

/**
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

  // Capture system prompt from the first LLM call in this run
  if (!context.systemPromptCaptured && messages[0]) {
    const systemMessage = messages[0].find(m => m._getType() === "system");
    if (systemMessage) {
      context.systemPrompt = typeof systemMessage.content === "string"
        ? systemMessage.content
        : JSON.stringify(systemMessage.content);
      context.systemPromptCaptured = true;
    }
  }

  // Track LLM inputs for detailed traces (optional)
  context.llmCalls = context.llmCalls || [];
  context.llmCalls.push({
    runId,
    parentRunId,
    inputMessageCount: messages[0]?.length ?? 0,
    hasSystemPrompt: messages[0]?.some(m => m._getType() === "system") ?? false,
    timestamp: new Date(),
  });
}
```

### Updated UsageContext

Shared with billing (see `langgraph_integration.md`). Messages are pushed via `handleLLMEnd`, avoiding fragile before/after state diffs.

```typescript
export interface UsageContext {
  records: UsageRecord[];
  chatId?: number;
  threadId?: string;
  graphName?: string;

  // System prompt capture
  systemPrompt?: string;
  systemPromptCaptured?: boolean;

  // Message capture for traces - pushed via handleLLMEnd callback
  // This is summarization-safe: captures LLM outputs, not state deltas
  messagesProduced: BaseMessage[];
  userInput?: BaseMessage;  // Set at run start, not from callback

  // LLM call tracking (optional, for detailed traces)
  llmCalls?: {
    runId: string;
    parentRunId?: string;
    inputMessageCount: number;
    hasSystemPrompt: boolean;
    timestamp: Date;
  }[];
}
```

### Updated Trace Schema

```ruby
create_table :conversation_traces,
  partition_key: :created_at,
  partition_type: :range do |t|

  t.references :chat, null: false
  t.string :thread_id, null: false
  t.string :run_id, null: false
  t.string :graph_name

  t.jsonb :messages, null: false        # All messages including context
  t.text :system_prompt                  # Captured from first LLM call
  t.jsonb :usage_summary
  t.jsonb :llm_calls                     # Optional: detailed call tracking

  t.datetime :created_at, null: false

  t.index [:thread_id, :created_at]
  t.index [:chat_id, :created_at]
  t.index :run_id, unique: true
end
```

---

## Architecture

Messages and usage are captured via the same LLM callbacks (see `langgraph_integration.md`), then persisted in parallel:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Graph Execution                              │
│                                                                      │
│  runWithUsageTracking({ userInput })                                │
│      │                                                               │
│      │  ┌─── handleLLMEnd callback ───────────────────────────────┐ │
│      │  │                                                          │ │
│      │  │  context.records.push(usageRecord)      ← For billing   │ │
│      │  │  context.messagesProduced.push(message) ← For traces    │ │
│      │  │                                                          │ │
│      │  └──────────────────────────────────────────────────────────┘ │
│      │                                                               │
│      └── On completion (returns usage, messagesProduced, systemPrompt):
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

Each run saves **only the messages from that run**:
- `userInput`: The user's message (known at run start)
- `messagesProduced`: LLM outputs captured via `handleLLMEnd` callback

**ToolMessages**: When an agent calls tools, the flow is:
1. LLM returns AIMessage with tool_calls → captured via `handleLLMEnd`
2. Tool executes → ToolMessage created
3. LLM called again with ToolMessage → captured via `handleLLMEnd`

ToolMessages may or may not appear in `handleLLMEnd` directly (TBD during implementation). If not, they can be reconstructed from the tool_call + tool output, or captured via `handleToolEnd`.

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

**Summarization-safe.** We capture via callbacks, not state diffs. Even if summarization mutates `state.messages`, we've already captured the LLM outputs directly.

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

  t.jsonb :messages, null: false   # Serialized BaseMessage[] (includes context messages)
  t.text :system_prompt            # Captured from first LLM call via callback
  t.jsonb :usage_summary           # { total_cost_usd, llm_call_count, total_tokens }
  t.jsonb :llm_calls               # Optional: per-LLM-call details

  t.datetime :created_at, null: false

  t.index [:thread_id, :created_at]
  t.index [:chat_id, :created_at]
  t.index :run_id, unique: true
end
```

**Note**: No foreign key constraint on `chat_id` to allow partition drops without cascading.

### Message JSONB Structure

Each message in the `messages` array includes:

```json
{
  "type": "human",
  "content": "Make the headline more compelling",
  "name": null,
  "id": "msg-123",
  "additional_kwargs": {},
  "is_context_message": false
}
```

For context messages:

```json
{
  "type": "human",
  "content": "User is now viewing the Pricing page",
  "name": "context",
  "id": "msg-124",
  "additional_kwargs": {
    "context_type": "system_injected",
    "timestamp": "2026-01-23T10:30:00Z"
  },
  "is_context_message": true
}
```

The `is_context_message` flag enables easy filtering in SQL:

```sql
-- Count context messages per run
SELECT
  run_id,
  COUNT(*) FILTER (WHERE msg->>'is_context_message' = 'true') as context_count,
  COUNT(*) FILTER (WHERE msg->>'is_context_message' = 'false') as user_count
FROM conversation_traces,
     jsonb_array_elements(messages) as msg
GROUP BY run_id;
```

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
  systemPrompt?: string;
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
  if (newMessages.length === 0 && !context.systemPrompt) return;

  await db.insert(conversationTraces).values({
    chatId: context.chatId,
    threadId: context.threadId,
    runId: context.runId,
    graphName: context.graphName,
    messages: serializeMessages(newMessages),
    systemPrompt: context.systemPrompt,
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
    additional_kwargs: (msg as any).additional_kwargs,
    id: msg.id,
    // Derived flags for easier querying
    is_context_message: (msg as any).name === "context",
  }));
}
```

### Langgraph: Integration with Run Wrapper

Messages are captured via `handleLLMEnd` callback (see `langgraph_integration.md`), not before/after state diffs. This is **summarization-safe** - we capture exactly what the LLM produced, regardless of state mutations.

```typescript
// langgraph_app/app/core/billing/executeWithTracking.ts

import { runWithUsageTracking, type UsageRecord } from "./usageTracker";
import { persistUsageRecords } from "./persistUsage";
import { persistTrace } from "../traces/persistTrace";

interface ExecuteOptions {
  chatId: number;
  threadId: string;
  graphName: string;
  userInput?: BaseMessage;  // The user's input message (known upfront)
  onComplete?: (runId: string) => Promise<void>;
}

export async function executeWithTracking<TState extends { messages?: BaseMessage[] }>(
  graph: CompiledGraph<TState>,
  state: TState,
  config: LangGraphRunnableConfig,
  options: ExecuteOptions
): Promise<TState> {
  const runId = crypto.randomUUID();

  // Messages are captured via handleLLMEnd callback - no before/after diffing needed
  // This is summarization-safe: we capture LLM outputs, not state deltas
  const { result, usage, systemPrompt, messagesProduced } = await runWithUsageTracking(
    {
      chatId: options.chatId,
      threadId: options.threadId,
      graphName: options.graphName,
      userInput: options.userInput,
    },
    () => graph.invoke(state, config)
  );

  // Combine user input (known upfront) with LLM-produced messages
  const traceMessages = [
    options.userInput,
    ...messagesProduced,
  ].filter(Boolean) as BaseMessage[];

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
        systemPrompt,  // Captured from handleLLMStart callback
      },
      traceMessages,
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

### Rails: No Endpoint Needed

With the simplified architecture, Rails doesn't need an endpoint for Langgraph to call. Instead, Rails runs a periodic job that processes unprocessed records. See `langgraph_integration.md` for the full `Credits::ProcessUsageJob` implementation.

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
| Per-LLM-call costs | `llm_usage_records` | Langgraph (direct Postgres) | Rails (billing job) |
| Credit transactions | `credit_transactions` | Rails | Rails (accounting) |
| Full message history | `conversation_traces` | Langgraph (direct Postgres) | Analytics/Learning |

**Key relationships via `run_id`:**
```
conversation_traces.run_id ←→ llm_usage_records.run_id ←→ credit_transactions.reference_id
```

The billing system (`langgraph_integration.md`) and trace system are **parallel writes** from the same `executeWithTracking()` call. They share `run_id` for correlation:
- Query "what did this conversation cost?" → join traces to usage records on `run_id`
- Query "what usage drove this charge?" → join transactions to usage records on `reference_id = run_id`

## Implementation Checklist

### Phase 1: Context Message Standardization

#### Langgraph

- [ ] Create `app/utils/contextMessages.ts` with:
  - [ ] `CONTEXT_MESSAGE_NAME` constant
  - [ ] `isContextMessage()` function
  - [ ] `createContextMessage()` function
  - [ ] `createMultimodalContextMessage()` function
- [ ] Deprecate `app/utils/pseudoMessages.ts` (keep for backwards compat temporarily)
- [ ] Update `brainstorm/agent.ts`:
  - [ ] Remove `filterPseudoMessages()` call
  - [ ] Return full messages array
- [ ] Update `ads/agent.ts`:
  - [ ] Remove `filterPseudoMessages()` call
  - [ ] Return full messages array
- [ ] Update any tools using `createPseudoMessage` → `createContextMessage`
- [ ] Add `handleChatModelStart` to `UsageTrackingCallback` for system prompt capture

#### LanggraphAISDK

- [ ] Create `src/contextMessages.ts` with `isContextMessage()`
- [ ] Update `loadThreadHistory()`:
  - [ ] Filter context messages before mapping to UI
- [ ] Update `RawMessageHandler.handle()`:
  - [ ] Skip context messages during streaming
- [ ] Export `isContextMessage` for consumer use if needed

### Phase 2: Trace Persistence

#### Rails

- [ ] Create migration for `conversation_traces` (partitioned)
  - [ ] Include `system_prompt` text column
  - [ ] Include `llm_calls` JSONB column
- [ ] Create initial partitions (current month + 2 ahead)
- [ ] Create `ConversationTrace` model (read-only)
- [ ] Create `ManageTracePartitionsJob` for monthly maintenance
- [ ] Create `Credits::ProcessUsageJob` (see `langgraph_integration.md`)
- [ ] Schedule job with Sidekiq-Cron (every minute)

#### Langgraph

- [ ] Reflect schema to get `conversationTraces` table in Drizzle
- [ ] Create `persistTrace.ts` with message serialization
  - [ ] Include `is_context_message` flag in serialized messages
  - [ ] Include `additional_kwargs` for metadata preservation
- [ ] Update `executeWithTracking` to:
  - [ ] Capture new messages
  - [ ] Pass system prompt from usage context
- [ ] Write trace in parallel with usage records
- [ ] Notify Rails with just `run_id` after writes complete

### Phase 3: Cleanup

- [ ] Remove `pseudoMessages.ts` after migration verified
- [ ] Update tests to use `contextMessages`
- [ ] Add analytics queries for context message patterns

### Drizzle Schema

After Rails migration, run:
```bash
pnpm run db:reflect
```

This will add `conversationTraces` to the Drizzle schema.

---

## Future Enhancements

- [ ] Compression for large message arrays (pg_lz4)
- [ ] Sampling for very high-volume graphs
- [ ] Export pipeline to data lake for ML training
- [ ] Trace search/filtering UI in admin panel
- [ ] Query helpers for "show me runs with N+ context messages"
- [ ] System prompt versioning and diff tracking
