# Langgraph Usage Tracking Spike - Test-First Scope of Work

## Overview

This document defines a **RED/GREEN/REFACTOR** approach to validating the Langgraph callback system for usage tracking. We spell out all tests FIRST, then implement the minimum code to make them pass.

**Goal**: Validate schema decisions before committing to database migrations by proving that:
1. `handleLLMEnd` fires for ALL LLM call patterns (agents, tools, middleware)
2. AsyncLocalStorage context survives async boundaries
3. Usage metadata is extractable from both Anthropic and OpenAI
4. Multiple runs don't double-count

**Simplification**: Langgraph only tracks raw usage (tokens, model name). Rails handles all pricing/cost calculation. Langgraph's job is: track → write to DB → notify Rails.

---

## Test Graph Design

We'll create a dedicated test graph that exercises all LLM call patterns:

```
UsageTrackingTestGraph
│
├── entryNode (routes based on test scenario)
│     │
│     ├── [scenario: "direct"] → directLLMNode → END
│     │     └── Calls getLLM().invoke() directly
│     │
│     ├── [scenario: "agent"] → agentNode → END
│     │     └── Uses createReactAgent with tools, loops multiple times
│     │
│     ├── [scenario: "tool-llm"] → toolWithInternalLLMNode → END
│     │     └── Node uses a tool that internally calls getLLM()
│     │
│     └── [scenario: "middleware"] → middlewareLLMNode → END
│           └── Node uses middleware that calls LLM (like summarization)
```

### Test Graph State

```typescript
interface UsageTrackingTestState extends CoreGraphState {
  scenario: "direct" | "agent" | "tool-llm" | "middleware";
  iterationCount?: number;      // For controlling agent loop iterations
  providerOverride?: "anthropic" | "openai";  // Force specific provider
}
```

---

## Test Suites (RED Phase)

### File: `langgraph_app/tests/tests/core/billing/usageTracking.test.ts`

---

### Suite 1: AsyncLocalStorage Context Survival

**Purpose**: Verify context propagates through all async patterns

```typescript
describe("UsageContext AsyncLocalStorage", () => {
  describe("context propagation", () => {
    it("survives across a single await boundary", async () => {
      // ARRANGE: Create context with runWithUsageTracking
      // ACT: Await a promise, then check getUsageContext()
      // ASSERT: Context is still accessible
    });

    it("survives across multiple sequential awaits", async () => {
      // ARRANGE: Create context
      // ACT: Chain 3+ awaits, check context after each
      // ASSERT: All checks return same context
    });

    it("survives across Promise.all() parallel execution", async () => {
      // ARRANGE: Create context
      // ACT: Promise.all([fn1, fn2, fn3]) where each checks context
      // ASSERT: All parallel branches see same context
    });

    it("survives into tool execution callbacks", async () => {
      // ARRANGE: Create context, define tool that checks context
      // ACT: Execute agent with tool
      // ASSERT: Tool saw the context
    });

    it("survives into nested function calls (3+ levels deep)", async () => {
      // ARRANGE: Create context
      // ACT: fn1 -> fn2 -> fn3 -> getUsageContext()
      // ASSERT: Context accessible at deepest level
    });

    it("returns undefined when called outside runWithUsageTracking", () => {
      // ARRANGE: No context setup
      // ACT: Call getUsageContext()
      // ASSERT: Returns undefined, no error
    });
  });

  describe("isolation", () => {
    it("separate sequential runs have isolated contexts", async () => {
      // ARRANGE: Run A, collect records
      // ACT: Run B, collect records
      // ASSERT: Run A records !== Run B records
    });

    it("concurrent runs (Promise.all) do not contaminate each other", async () => {
      // ARRANGE: Start runs A and B concurrently
      // ACT: Both add records to their contexts
      // ASSERT: A's records only in A, B's records only in B
    });

    it("records accumulated during run are returned after completion", async () => {
      // ARRANGE: Run with multiple LLM calls
      // ACT: Complete run
      // ASSERT: All records present in returned usage array
    });
  });
});
```

---

### Suite 2: Callback Handler Mechanics

**Purpose**: Verify callback methods extract data correctly

```typescript
describe("UsageTrackingCallbackHandler", () => {
  describe("handleChatModelStart", () => {
    it("captures system prompt from first message batch", async () => {
      // ARRANGE: Messages with SystemMessage first
      // ACT: Trigger handleChatModelStart
      // ASSERT: context.systemPrompt contains the content
    });

    it("captures system prompt only once (first call wins)", async () => {
      // ARRANGE: Context with no systemPrompt yet
      // ACT: Call handleChatModelStart twice with different prompts
      // ASSERT: First prompt is preserved
    });

    it("handles messages array without system message", async () => {
      // ARRANGE: Messages = [HumanMessage, AIMessage]
      // ACT: Trigger handleChatModelStart
      // ASSERT: No error, systemPrompt remains undefined
    });

    it("handles empty messages array gracefully", async () => {
      // ARRANGE: Messages = [[]]
      // ACT: Trigger handleChatModelStart
      // ASSERT: No error, systemPrompt remains undefined
    });
  });

  describe("handleLLMEnd", () => {
    it("extracts usage_metadata from AIMessage and creates UsageRecord", async () => {
      // ARRANGE: LLMResult with AIMessage containing usage_metadata
      // ACT: Trigger handleLLMEnd
      // ASSERT: UsageRecord added to context.records
    });

    it("accumulates multiple records for multi-turn conversations", async () => {
      // ARRANGE: Context with 1 existing record
      // ACT: Trigger handleLLMEnd 2 more times
      // ASSERT: context.records.length === 3
    });

    it("captures message content for traces (messagesProduced)", async () => {
      // ARRANGE: Context with empty messagesProduced
      // ACT: Trigger handleLLMEnd with AIMessage
      // ASSERT: Message added to context.messagesProduced
    });

    it("handles missing usage_metadata gracefully (no record added)", async () => {
      // ARRANGE: AIMessage without usage_metadata
      // ACT: Trigger handleLLMEnd
      // ASSERT: No error, no record added (or record with zeros)
    });

    it("no-ops when called outside tracking context", async () => {
      // ARRANGE: No runWithUsageTracking wrapper
      // ACT: Trigger handleLLMEnd
      // ASSERT: No error, nothing happens
    });
  });
});
```

---

### Suite 3: Integration with Real Graph Patterns

**Purpose**: Verify tracking works with actual LangGraph execution patterns

```typescript
describe("Usage Tracking Integration", () => {
  describe("direct model.invoke()", () => {
    it("fires handleLLMEnd and captures usage for Anthropic", async () => {
      // ARRANGE: testGraph().withTracking().withState({ scenario: "direct", providerOverride: "anthropic" })
      // ACT: Execute graph
      // ASSERT: tracking.usage has 1 record with Anthropic model name
    });

    it("fires handleLLMEnd and captures usage for OpenAI", async () => {
      // ARRANGE: testGraph().withTracking().withState({ scenario: "direct", providerOverride: "openai" })
      // ACT: Execute graph
      // ASSERT: tracking.usage has 1 record with OpenAI model name
    });

    it("captures correct input_tokens and output_tokens", async () => {
      // ARRANGE: Execute with known prompt length
      // ACT: Get tracking result
      // ASSERT: inputTokens > 0, outputTokens > 0
    });
  });

  describe("agent tool loops", () => {
    it("fires handleLLMEnd for initial agent reasoning call", async () => {
      // ARRANGE: testGraph().withTracking().withState({ scenario: "agent", iterationCount: 1 })
      // ACT: Execute agent that uses 1 tool
      // ASSERT: At least 2 records (initial + after tool)
    });

    it("fires handleLLMEnd for EACH iteration in multi-turn loop", async () => {
      // ARRANGE: Agent configured to loop 3 times
      // ACT: Execute graph
      // ASSERT: At least 4 records (initial + 3 tool responses)
    });

    it("accumulates all records with correct runId grouping", async () => {
      // ARRANGE: Multi-turn agent
      // ACT: Execute, get tracking
      // ASSERT: All records have same logical grouping
    });
  });

  describe("tools calling getLLM() internally", () => {
    it("fires handleLLMEnd for tool-internal LLM call", async () => {
      // ARRANGE: testGraph().withTracking().withState({ scenario: "tool-llm" })
      // ACT: Execute node that uses llmSummarizerTool
      // ASSERT: tracking.usage includes record from tool's LLM call
    });

    it("context survives from graph execution into tool callback", async () => {
      // ARRANGE: Tool that logs whether it saw context
      // ACT: Execute
      // ASSERT: Tool confirms it saw context
    });

    it("tool LLM records are accumulated to parent context", async () => {
      // ARRANGE: Node makes 1 LLM call, tool makes 1 LLM call
      // ACT: Execute
      // ASSERT: tracking.usage.length >= 2
    });
  });

  describe("middleware that calls LLMs", () => {
    it("fires handleLLMEnd for middleware LLM call", async () => {
      // ARRANGE: testGraph().withTracking().withState({ scenario: "middleware" })
      // ACT: Execute node with summarization middleware
      // ASSERT: tracking.usage includes middleware's LLM record
    });

    it("middleware LLM calls attributed to same run context", async () => {
      // ARRANGE: Node + middleware both call LLM
      // ACT: Execute
      // ASSERT: Both records in same tracking result
    });
  });
});
```

---

### Suite 4: Provider-Specific Field Extraction

**Purpose**: Verify we correctly extract fields from different providers

```typescript
describe("Provider-Specific Usage Metadata", () => {
  describe("Anthropic Claude models", () => {
    it("extracts input_tokens from usage_metadata.input_tokens", async () => {
      // Use real or fixture data with known values
      // ASSERT: record.inputTokens matches expected
    });

    it("extracts output_tokens from usage_metadata.output_tokens", async () => {
      // ASSERT: record.outputTokens matches expected
    });

    it("extracts cache_creation_input_tokens when present", async () => {
      // ASSERT: record.cacheCreationTokens matches expected
    });

    it("extracts cache_read_input_tokens when present", async () => {
      // ASSERT: record.cacheReadTokens matches expected
    });

    it("extracts model from response_metadata.model", async () => {
      // ASSERT: record.model === "claude-haiku-4-5-20251001" or similar
    });

    it("normalizes versioned model name for pricing lookup", async () => {
      // INPUT: "claude-haiku-4-5-20251001"
      // ASSERT: record.normalizedModel === "claude-haiku-4-5"
    });
  });

  describe("OpenAI GPT models", () => {
    it("extracts input_tokens from usage_metadata.input_tokens", async () => {
      // ASSERT: record.inputTokens matches expected
    });

    it("extracts output_tokens from usage_metadata.output_tokens", async () => {
      // ASSERT: record.outputTokens matches expected
    });

    it("extracts reasoning_tokens from output_token_details.reasoning", async () => {
      // ASSERT: record.reasoningTokens matches expected (may be 0)
    });

    it("extracts model from response_metadata.model_name", async () => {
      // ASSERT: record.model === "gpt-4.1-mini-2025-04-14" or similar
    });

    it("normalizes versioned model name for pricing lookup", async () => {
      // INPUT: "gpt-4.1-mini-2025-04-14"
      // ASSERT: record.normalizedModel === "gpt-4.1-mini"
    });
  });
});
```

---

### Suite 5: Multiple Runs Without Double Counting

**Purpose**: Core billing integrity - ensure no double counting

```typescript
describe("Multiple Runs Without Double Counting", () => {
  it("sequential runs produce independent usage records", async () => {
    // ARRANGE: Execute graph twice sequentially
    const run1 = await testGraph().withTracking().withState({ scenario: "direct" }).execute();
    const run2 = await testGraph().withTracking().withState({ scenario: "direct" }).execute();

    // ASSERT: Each run has its own records
    expect(run1.tracking.usage).not.toBe(run2.tracking.usage);
    expect(run1.tracking.usage.length).toBeGreaterThan(0);
    expect(run2.tracking.usage.length).toBeGreaterThan(0);
  });

  it("each run generates unique runId for its records", async () => {
    // Execute multiple runs, extract runIds
    // ASSERT: All runIds are unique UUIDs
  });

  it("concurrent runs (Promise.all) maintain isolated records", async () => {
    // ARRANGE: Start 3 runs concurrently
    const [r1, r2, r3] = await Promise.all([
      testGraph().withTracking().withState({ scenario: "direct" }).execute(),
      testGraph().withTracking().withState({ scenario: "direct" }).execute(),
      testGraph().withTracking().withState({ scenario: "direct" }).execute(),
    ]);

    // ASSERT: Each has independent records, no contamination
    // Total records = sum of individual, not multiplied
  });

  it("completing run A does not affect in-progress run B", async () => {
    // ARRANGE: Start run B, then start and complete run A
    // ASSERT: Run B's context still intact after A completes
  });

  it("records from one run are not visible in another run's context", async () => {
    // The inverse of contamination - explicit check
  });
});
```

---

## Files to Create

### 1. `langgraph_app/app/core/billing/usageTracker.ts`

```typescript
// Core types and implementation:
// - UsageRecord interface (raw usage only - no cost)
// - UsageContext interface
// - AsyncLocalStorage instance
// - getUsageContext()
// - runWithUsageTracking()
// - UsageTrackingCallbackHandler class
// - usageTracker singleton export
```

### 2. `langgraph_app/app/core/billing/persistUsage.ts`

```typescript
// Database persistence:
// - persistUsageRecords(usage, chatId, runId, graphName) - writes to llm_usage table
// - notifyRails(runId) - POST to Rails to trigger credit charging
```

### 3. `langgraph_app/tests/tests/core/billing/usageTracking.test.ts`

All test suites defined above.

### 4. `langgraph_app/tests/tests/core/billing/usageTrackingTestGraph.ts`

```typescript
// Test graph definition:
// - UsageTrackingTestState interface
// - directLLMNode - calls getLLM().invoke() directly
// - agentNode - uses createReactAgent with tools
// - toolWithInternalLLMNode - uses tool that calls getLLM()
// - middlewareLLMNode - uses middleware that calls LLM
// - usageTrackingTestGraph compiled graph export
```

### 5. `langgraph_app/tests/support/fixtures/usageTracking.ts`

```typescript
// Test fixtures:
// - MOCK_ANTHROPIC_USAGE_METADATA
// - MOCK_OPENAI_USAGE_METADATA
// - EXPECTED_COST_CALCULATIONS
// - Sample LLMResult objects for callback testing
```

---

## Files to Modify

### 1. `langgraph_app/tests/support/graph/graphTester.ts`

Add to `GraphTestBuilder`:

```typescript
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

getTrackingResult() {
  return this.trackingResult;
}

// Modify execute() to use runWithUsageTracking when trackingEnabled
```

### 2. `langgraph_app/app/core/llm/llm.ts`

After tests pass, attach callback:

```typescript
import { usageTracker } from "../billing/usageTracker";

export async function getLLM(options: LLMOptions = {}): Promise<BaseChatModel> {
  const model = await LLMManager.get(/* ... */);

  // Attach usage tracking callback
  return model.withConfig({
    callbacks: [usageTracker],
  });
}
```

---

## Implementation Order

### Phase 1: RED (Write Failing Tests)

1. Create `usageTracking.test.ts` with all test suites
2. Create `usageTrackingTestGraph.ts` skeleton (compiles but nodes not implemented)
3. Create fixture files
4. **Run tests - all should fail** (proves tests are actually checking something)

### Phase 2: GREEN (Minimal Implementation)

1. Implement `usageTracker.ts`:
   - Types first (UsageRecord with raw tokens, no cost)
   - AsyncLocalStorage setup
   - `runWithUsageTracking()`
   - `UsageTrackingCallbackHandler` with `handleChatModelStart` and `handleLLMEnd`

2. Implement `persistUsage.ts`:
   - `persistUsageRecords()` - writes to Postgres
   - `notifyRails()` - POST to Rails API

3. Add `withTracking()` to GraphTestBuilder

4. Implement test graph nodes:
   - `directLLMNode`
   - `agentNode` with tools
   - `toolWithInternalLLMNode`
   - `middlewareLLMNode`

5. **Run tests - iterate until all pass**

### Phase 3: REFACTOR

1. Clean up code, improve types
2. Add JSDoc documentation
3. Extract any reusable patterns
4. Document actual `usage_metadata` structure discovered

---

## Verification Checklist

### Must Pass Before Scope 1 (Database Foundation)

- [ ] `handleLLMEnd` fires for direct `model.invoke()`
- [ ] `handleLLMEnd` fires for agent tool loops (all iterations)
- [ ] `handleLLMEnd` fires for tools calling `getLLM()` internally
- [ ] `handleLLMEnd` fires for middleware-based LLM calls
- [ ] AsyncLocalStorage context survives multi-turn agent execution
- [ ] Anthropic `usage_metadata` fields extracted correctly (tokens + model)
- [ ] OpenAI `usage_metadata` fields extracted correctly (tokens + model)
- [ ] System prompt captured via `handleChatModelStart`
- [ ] Multiple sequential runs produce independent usage records
- [ ] Concurrent runs do not contaminate each other

**Note**: Cost calculation is handled by Rails, not Langgraph.

### Spike Output Document

After all tests pass, create `plans/billing/spike-findings.md` documenting:

1. Actual `usage_metadata` structure for Anthropic
2. Actual `usage_metadata` structure for OpenAI
3. Model name formats returned by each provider
4. Any edge cases discovered
5. Confirmed schema for `llm_usage` table

---

## Critical File References

| File | Purpose |
|------|---------|
| `langgraph_app/tests/support/graph/graphTester.ts` | Extend with `withTracking()` |
| `langgraph_app/app/core/llm/llm.ts` | Where callback attaches to all LLMs |
| `langgraph_app/app/core/node/middleware/withContext.ts` | AsyncLocalStorage pattern to follow |
| `langgraph_app/app/tools/brainstorm/saveAnswers.ts:120` | Real tool calling getLLM() internally |
| `langgraph_app/scripts/explore-usage-metadata.ts` | Existing exploration showing usage_metadata |

---

## Success Criteria

The spike is **complete** when:

1. All 5 test suites pass (35+ individual tests)
2. We have documented exact `usage_metadata` structure for both providers
3. We have confirmed AsyncLocalStorage survives all execution patterns
4. We have a validated schema for the `llm_usage` table (raw tokens, no cost - Rails calculates)
5. We can confidently proceed to Scope 1 (Database Foundation)

**Estimated effort**: 2-3 days (tests first, then implementation)
