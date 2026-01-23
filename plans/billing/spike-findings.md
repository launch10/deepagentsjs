# Usage Tracking Spike Findings

## Summary

The spike successfully validated the Langgraph callback system for usage tracking. All 41 tests pass, confirming that:

1. `handleLLMEnd` fires for ALL LLM call patterns (agents, tools, middleware)
2. AsyncLocalStorage context survives async boundaries
3. Usage metadata is extractable from both Anthropic and OpenAI
4. Multiple runs don't double-count

## Usage Metadata Structure

### Anthropic Claude Models

```typescript
// AIMessage.usage_metadata structure
{
  input_tokens: number;         // Total input tokens
  output_tokens: number;        // Total output tokens
  cache_creation_input_tokens?: number;  // Tokens used to create cache
  cache_read_input_tokens?: number;      // Tokens read from cache
}

// AIMessage.response_metadata structure
{
  model: string;       // e.g., "claude-haiku-4-5-20251001"
  stop_reason: string; // e.g., "end_turn"
}
```

### OpenAI GPT Models

```typescript
// AIMessage.usage_metadata structure
{
  input_tokens: number;   // Total input tokens
  output_tokens: number;  // Total output tokens
  output_token_details?: {
    reasoning: number;    // Reasoning tokens (for o1/o3 models)
  }
}

// AIMessage.response_metadata structure
{
  model_name: string;    // e.g., "gpt-4.1-mini-2025-04-14"
  finish_reason: string; // e.g., "stop"
}
```

### Key Differences

| Field | Anthropic | OpenAI |
|-------|-----------|--------|
| Model name | `response_metadata.model` | `response_metadata.model_name` |
| Cache creation | `cache_creation_input_tokens` | N/A |
| Cache read | `cache_read_input_tokens` | N/A |
| Reasoning tokens | N/A | `output_token_details.reasoning` |

## Model Name Formats

Both providers return versioned model names:

- **Anthropic**: `claude-haiku-4-5-20251001`, `claude-sonnet-4-5-20251001`
- **OpenAI**: `gpt-4.1-mini-2025-04-14`, `gpt-4.1-2025-04-14`

**Note**: Rails handles model name normalization for pricing lookup. Langgraph stores the raw versioned name.

## Edge Cases Discovered

1. **Agent tool batching**: Agents may batch multiple tool calls into a single LLM iteration, resulting in fewer `handleLLMEnd` calls than expected. This is correct behavior - we track actual LLM calls, not expected ones.

2. **Missing usage_metadata**: Some edge cases (streaming, errors) may not include usage_metadata. The callback safely no-ops - the message is still captured for traces, but no usage record is created.

3. **Context outside tracking**: Calling `getUsageContext()` outside `runWithUsageTracking()` returns undefined safely. The callback handler no-ops when there's no context.

## Confirmed Schema for `llm_usage` Table

```typescript
interface UsageRecord {
  runId: string;           // LangChain run ID
  parentRunId?: string;    // Parent run ID for nested calls
  model: string;           // Raw model name from provider
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number; // OpenAI o1/o3 models
  cacheCreationTokens: number; // Anthropic cache
  cacheReadTokens: number;     // Anthropic cache
  timestamp: Date;
  tags?: string[];
  metadata?: Record<string, unknown>;
  // NOTE: No costUsd - Rails handles all pricing
}
```

## Files Created

| File | Purpose |
|------|---------|
| `langgraph_app/app/core/billing/usageTracker.ts` | Core tracking implementation |
| `langgraph_app/app/core/billing/index.ts` | Export barrel |
| `langgraph_app/tests/tests/core/billing/usageTracking.test.ts` | 41 tests |
| `langgraph_app/tests/tests/core/billing/usageTrackingTestGraph.ts` | Test graph |
| `langgraph_app/tests/support/fixtures/usageTracking.ts` | Test fixtures |

## Files Modified

| File | Change |
|------|--------|
| `langgraph_app/app/core/llm/llm.ts` | Attach usageTracker callback to all models |
| `langgraph_app/tests/support/graph/graphTester.ts` | Add withTracking() method |
| `langgraph_app/app/annotation/index.ts` | Export BaseAnnotation |

## Next Steps

Ready to proceed with **Scope 1: Database Foundation**:

1. Create `llm_usage` table migration in Rails
2. Implement `persistUsage.ts` to write records
3. Add `notifyRails()` to trigger credit charging
4. Update graphs to persist usage after execution
