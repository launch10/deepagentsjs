# Langgraph Credit Integration

## Overview

This document describes how to track AI usage at the message level in Langgraph and charge credits accordingly.

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
// AIMessage.usage_metadata structure
{
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;  // Anthropic cache write
  cache_read_input_tokens?: number;      // Anthropic cache read (90% cheaper)
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

### MessagePersistence Middleware

New middleware that wraps nodes to detect and persist new messages:

```typescript
// langgraph_app/app/core/node/middleware/withMessagePersistence.ts

export const withMessagePersistence = <TState extends BaseGraphState>(
  node: NodeFunction<TState>,
  config?: MessagePersistenceConfig
): NodeFunction<TState> => {
  return async (state: TState, lcConfig: LangGraphRunnableConfig) => {
    // Capture message count before node execution
    const beforeCount = (state.messages ?? []).length;

    // Execute the node
    const result = await node(state, lcConfig);

    // Find new messages (positional detection)
    const allMessages = [...(state.messages ?? []), ...(result.messages ?? [])];
    const newMessages = allMessages.slice(beforeCount);

    // Persist and charge
    for (const msg of newMessages) {
      if (isAIMessage(msg)) {
        await persistAndChargeAIMessage(msg, lcConfig, state);
      } else if (isToolMessage(msg)) {
        await persistToolMessage(msg, lcConfig, state);  // Audit only
      }
    }

    return result;
  };
};
```

### Data Model

#### New Table: `langgraph_messages`

```ruby
create_table :langgraph_messages do |t|
  t.references :chat, null: false, foreign_key: true
  t.string :message_type, null: false      # ai, tool, human
  t.string :run_id, index: true
  t.string :node_name
  t.integer :message_index                 # position in thread

  # Usage (only populated for AIMessage)
  t.integer :input_tokens
  t.integer :output_tokens
  t.integer :cache_creation_tokens
  t.integer :cache_read_tokens
  t.decimal :cost_usd, precision: 10, scale: 6
  t.string :model_key                      # e.g., claude-sonnet-4-20250514

  # Audit
  t.jsonb :content_summary                 # truncated for audit
  t.boolean :charged, default: false

  t.timestamps

  t.index [:chat_id, :message_index]
  t.index [:run_id, :message_type]
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
  reference: langgraph_message,  # type: "LanggraphMessage"
  metadata: {
    graph: "website",
    node_name: "generatePage",
    model_key: "claude-sonnet-4-20250514"
  }
)
```

### Flow

```
Node executes
    ↓
MessagePersistence middleware detects new messages
    ↓
For each new AIMessage:
    1. Calculate cost from usage_metadata + model pricing
    2. Save to langgraph_messages table
    3. Enqueue Credits::ChargeMessageJob(message_id)
    ↓
For each ToolMessage:
    - Save to langgraph_messages (audit only, no charge)
    ↓
ChargeMessageJob:
    1. Load LanggraphMessage
    2. Create CreditTransaction referencing it
    3. Mark message as charged: true
```

## Detecting New Messages

Existing pattern in codebase (positional, not ID-based):

```typescript
// From /brainstorm/agent.ts
const originalMessageCount = (state.messages || []).length;
const result = await agent.invoke(state);
const newMessages = result.messages.slice(originalMessageCount);
```

This works because `messagesStateReducer` is append-only.

## Open Questions

### 1. Content Storage
- **Full content**: Better audit, more storage
- **Summary/hash**: Less storage, harder to audit
- **Recommendation**: Store truncated summary (first 500 chars) + content hash

### 2. Charge Granularity
- **Per-AIMessage**: More accurate, more transactions
- **Batch at end of run**: Fewer transactions, need to track run boundaries
- **Recommendation**: Per-AIMessage (simpler, matches LLM call boundaries)

### 3. ToolMessage Persistence
- **Store**: Full audit trail, but duplicates checkpoint data
- **Skip**: Less storage, rely on checkpoints for audit
- **Recommendation**: Store minimal record (type, tool_call_id, timestamp) for linking

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

*To be filled in after exploration...*

```typescript
// Placeholder for actual usage_metadata inspection
// Run test agent and log:
// - message.constructor.name
// - message.usage_metadata
// - message.response_metadata
// - message.additional_kwargs
```
