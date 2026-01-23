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
  t.integer :reasoning_tokens              # OpenAI only, included in output_tokens
  t.integer :cache_creation_tokens         # Anthropic only
  t.integer :cache_read_tokens             # Anthropic only
  t.decimal :cost_usd, precision: 10, scale: 6
  t.string :model_key                      # NORMALIZED name, e.g., "claude-haiku-4-5" not "claude-haiku-4-5-20251001"

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

Based on exploration findings:

- [ ] Store `model_key` as the **normalized** name (e.g., `claude-haiku-4-5`), not the versioned name
- [ ] Handle both `response_metadata.model_name` (OpenAI) and `response_metadata.model` (Anthropic)
- [ ] Handle cache tokens in both locations: `cache_*_input_tokens` and `input_token_details.cache_*`
- [ ] Track reasoning tokens for OpenAI models (separate from regular output for cost breakdown)
- [ ] Pricing table must include `cost_reasoning` for models that support it
- [ ] Test script available at `scripts/explore-usage-metadata.ts` for future validation
