# Deep Agent Cost Analysis & Optimization Plan

**Date**: 2026-02-04
**Data Source**: platform.claude.com API logs (1,214 requests)

---

## 1. Today's Cost Summary

| Model | Requests | Input Tokens | Output Tokens | Estimated Cost |
|-------|----------|-------------|---------------|----------------|
| Claude Sonnet 4.5 | 763 | 10.3M | 1.3M | $38.00 |
| Claude Haiku 4.5 | 449 | 1.8M | 0.4M | $3.25 |
| Claude Sonnet 4 | 2 | 12K | 2K | $0.05 |
| **Total** | **1,214** | **12.1M** | **1.7M** | **~$45.25** |

### Token Spend Breakdown

- **89% ($40.09)** — Input tokens (re-reading conversation history each turn)
- **11% ($5.12)** — Output tokens (actual generation)

The overwhelming majority of cost is re-ingestion of growing context, not generation.

---

## 2. Sawtooth Run Detection

Deep agents exhibit a **sawtooth pattern** in input token usage: tokens accumulate as the conversation grows (each turn re-sends the full history), then drop sharply when a new agent run starts with fresh context.

Using a 40% drop threshold from recent peak, we identified **43 sub-runs** across **14 sessions**.

### Cost Distribution Across Sub-runs

| Category | Sub-runs | Total Cost | Avg Cost |
|----------|----------|------------|----------|
| Heavy runs ($3+) | 5 | $28.50 | $5.70 |
| Medium runs ($0.50-$3) | 12 | $12.80 | $1.07 |
| Light runs (<$0.50) | 26 | $3.95 | $0.15 |

---

## 3. Why Some Runs Cost $7 and Others $0.10

### The Cost Formula

```
cost = turns × avg_context_size × price_per_MTok
```

**Turn count is the #1 cost driver** (correlation r=0.72 with total cost).
Context size alone has weaker correlation (r=0.39).

### What Makes Runs Expensive

A 20-turn Sonnet run with growing context:
- Turn 1: 5K tokens → Turn 10: 50K tokens → Turn 20: 100K tokens
- Total input: ~1M tokens across all turns
- Cost: ~$3.00 in input alone

A 3-turn Sonnet run:
- Turn 1: 5K → Turn 2: 15K → Turn 3: 25K
- Total input: ~45K tokens
- Cost: ~$0.14

**The quadratic growth** of re-ingesting an ever-growing context is the fundamental cost driver.

---

## 4. Subagent Economics

### Current Subagent Usage

- 16 subagent runs identified (all Sonnet)
- Total subagent cost: **$1.12** (2.5% of total spend)
- Average 3.8 turns per subagent run

### When Subagents Save Money

Subagents are cheaper than inline execution **only when**:
1. They start with **fresh/small context** (not the full parent context)
2. They do **enough turns** to recoup the 2-turn spawn overhead

### Breakeven Analysis

| Subagent Model | Parent Context | Breakeven Turns |
|---------------|----------------|-----------------|
| Haiku | Any size | ~1 turn (always wins) |
| Sonnet | Fresh context | ~4 turns |
| Sonnet | Full parent context | Never (net loss) |

### Key Insight

**Sonnet subagents with full parent context are a NET LOSS.** The 2-turn overhead plus re-ingesting the parent's context negates any savings from isolation.

**Haiku subagents save money even with full context** due to the 3.75x price difference ($0.80/MTok vs $3.00/MTok input).

**Simplest win**: Route subagents to Haiku where quality allows.

---

## 5. Optimization Levers — Ranked by Impact

| Lever | Projected Savings | Complexity | Notes |
|-------|------------------|------------|-------|
| **Prompt caching** | 45-72% ($20-33) | Low | Currently broken (see Bug #1). Fix = immediate win. |
| **Halve turns via prompt engineering** | ~50% | Medium | Better instructions, fewer retries, smarter tool use |
| **Haiku routing for subagents** | ~68% of subagent cost | Low | Route appropriate tasks to Haiku |
| **Context trimming (10-25K cap)** | 11-20% | Medium | Diminishing returns vs caching |
| **Summarization middleware** | 15-25% | Medium | Already in deepagents, just commented out |

### Context Trimming Detail

| Cap | Estimated Savings | Risk |
|-----|-------------------|------|
| 25K tokens | 11% | Minimal — most turns under this |
| 20K tokens | 14% | Low |
| 15K tokens | 17% | Medium — may lose important context |
| 10K tokens | 20% | High — aggressive, quality risk |

**Verdict**: Context trimming provides modest savings. Prompt caching provides 3-5x more savings with zero quality risk. Fix caching first.

---

## 6. Bug #1: Prompt Caching Silently Disabled (CRITICAL)

### Impact

**$38/day in Sonnet spend with ZERO cache hits.** Every single Sonnet request pays full input token price.

With caching enabled, cache reads cost $0.30/MTok vs $3.00/MTok (90% cheaper). In agentic loops where the system prompt and early context are identical across turns, this is massive.

### Root Cause

The `anthropicPromptCachingMiddleware` in `deepagents` checks whether the model is a `ChatAnthropic` instance:

```javascript
// Inside deepagents/dist/index.js (anthropicPromptCachingMiddleware)
request.model.getName() === "ChatAnthropic"
```

But our model is **never** a raw `ChatAnthropic` when it reaches the middleware:

**Path 1: Custom model via `getLLM()`** (our current path)

```typescript
// llm.ts — getLLM() wraps the model
return new StructuredOutputRunnableBinding({
  bound: model,        // ChatAnthropic is inside here
  config: {},
  configFactories: [/* usage tracking */],
}) as unknown as BaseChatModel;
```

`getName()` on `StructuredOutputRunnableBinding` returns `"RunnableBinding"`, not `"ChatAnthropic"`.

**Path 2: `initChatModel()` without prefix**

```javascript
initChatModel("claude-sonnet-4-5-20250929")  // No "anthropic:" prefix
// Returns ConfigurableModel, modelProvider is undefined
```

### The Silent Failure

```javascript
anthropicPromptCachingMiddleware({ unsupportedModelBehavior: "ignore" })
//                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
// When model isn't recognized as ChatAnthropic, it silently skips caching
```

`unsupportedModelBehavior: "ignore"` means: don't warn, don't error, just... don't cache. Zero indication anything is wrong.

### Affected Code Path

```
createCodingAgent (agent.ts)
  → getLLM({ skill: "coding", speed: "slow", cost: "paid" })
    → LLMManager.get() → new ChatAnthropic(...)
    → Wrapped in StructuredOutputRunnableBinding (for usage tracking)
  → createDeepAgent({ model: wrappedLLM })
    → anthropicPromptCachingMiddleware sees RunnableBinding
    → getName() !== "ChatAnthropic"
    → unsupportedModelBehavior: "ignore"
    → CACHING SILENTLY SKIPPED
```

### Fix Options

1. **Unwrap the model before passing to deepagents** — Extract the raw `ChatAnthropic` from the `StructuredOutputRunnableBinding.bound` property, pass that to `createDeepAgent`, and attach usage tracking differently (e.g., via deepagents middleware or LangSmith).

2. **Use `anthropic:` prefix with `initChatModel`** — If deepagents uses `initChatModel` internally, ensure the `anthropic:` prefix is included so `modelProvider` is set correctly.

3. **Patch the middleware** — Use `pnpm patch` to modify `anthropicPromptCachingMiddleware` to recognize wrapped models:
   ```javascript
   // Unwrap RunnableBinding to find the actual model
   let actualModel = request.model;
   while (actualModel.bound) actualModel = actualModel.bound;
   if (actualModel.getName() === "ChatAnthropic") { /* apply caching */ }
   ```

4. **Move usage tracking into deepagents middleware** — Instead of wrapping the model, add a deepagents-compatible middleware that handles usage tracking, so the raw `ChatAnthropic` can be passed through.

**Recommended**: Option 1 (unwrap) or Option 3 (patch) for immediate fix. Option 4 for long-term cleanliness.

---

## 7. Observation: Billing Discrepancy (Under Investigation)

**Date observed**: 2026-02-04, 7:30-7:45 PM EST

A Haiku-only website build run (122 requests) showed a significant gap between
our internal usage tracking and Anthropic's reported token counts:

| Source | Cost |
|--------|------|
| Our `usageTracker` callbacks | **$1.06** |
| Anthropic platform logs (calculated) | **$1.75** |
| **Gap** | **$0.69 (39.5%)** |

Anthropic token counts for this run:
- Input: 1,941,810 tokens (× $0.80/MTok = $1.55)
- Output: 49,370 tokens (× $4.00/MTok = $0.20)
- Cache read: 0 | Cache create: 0

### Request Count Discrepancy

In addition to the cost gap, there's a request count mismatch:

| Source | Requests |
|--------|----------|
| Our `usageTracker` callbacks | **~55** |
| Anthropic platform logs | **122** |

This is a 2.2x difference — we're only tracking ~45% of actual API calls.

### Possible Explanations

1. **Missed requests** — Some API calls may not trigger our usage tracking callback
   (e.g., if `configFactories` gets stripped by certain LangChain operations like
   `bindTools`, subagent spawning, or middleware-initiated calls).
2. **Deepagents internal calls** — The deepagents library may make its own LLM calls
   (e.g., summarization, planning, subagent orchestration) that bypass our
   `StructuredOutputRunnableBinding` wrapper and its `configFactories`.
3. **Our pricing rates differ from Anthropic's** — If the `ModelConfig` from Rails
   has different `cost_per_input_token` / `cost_per_output_token` than Anthropic's
   actual rates, we'd under- or over-count even on tracked requests.
4. **LangChain reports fewer tokens** — The callback token counts may differ from
   Anthropic's server-side counts (e.g., system prompt tokens not included, or
   streaming token accounting differences).
5. **Token counting methodology** — Anthropic may count tokens differently than
   what's reported in streaming `message_delta` events.

### Run 2 (7:53 PM EST) — Much Closer Alignment

| Source | Requests | Cost |
|--------|----------|------|
| Internal tracker | **41** | **$0.79** |
| Anthropic logs | **39** | **$0.63** |

Request counts nearly match (41 vs 39). The Run 1 discrepancy (55 vs 122) was
likely a filtering artifact — the 00:30 UTC cutoff captured requests from a
prior run. Still need to compare internal cost vs Anthropic cost on this cleaner
data point.

Run 2 internal cost ($0.79) is 25% HIGHER than Anthropic ($0.63). This is the
opposite direction from Run 1, suggesting Run 1's cost gap was the filtering
artifact, not a real under-count. The ~25% overcount is consistent with the
LangChain output token double-counting bug (see Bug #2).

### Run 3 (7:57 PM EST) — Failed Run, Zero Internal Tracking

| Source | Requests | Cost |
|--------|----------|------|
| Internal tracker | **0** | **$0.00** |
| Anthropic logs | **67** | **$0.88** |

The run failed, and zero usage records were persisted internally. But Anthropic
still processed and billed for all 67 requests. This is a **revenue leakage bug**:
failed runs consume API credits ($0.88 in this case) but the user is never charged.

### Updated Assessment

- **Request count**: Aligned on successful runs (~41 vs 39). Failed runs leak entirely.
- **Cost on successful runs**: Internal charges ~25% more than Anthropic's raw cost,
  consistent with the output token double-counting bug.
- **Failed run leakage**: Usage callbacks either don't fire or records aren't
  persisted when runs fail. Need to investigate whether `usageTracker` writes are
  transactional with run completion or fire-and-forget per request.
- **Action items**:
  1. Ensure usage records are persisted per-request (fire-and-forget), not batched
     at run completion
  2. Compare `cost_per_input_token` / `cost_per_output_token` in Rails `ModelConfig`
     against Anthropic's published rates
  3. Fix the output token double-counting bug

### Also Confirmed

- **Prompt caching broken for Haiku too** — All 122 requests show `cache_read: 0`.
  The `StructuredOutputRunnableBinding` wrapping bug affects all models, not just Sonnet.
- **Haiku is 4-5x cheaper than Sonnet** for comparable website builds ($1-2 vs $5-7 per run).

---

## 8. Bug #2: LangChain Streaming Token Double-Counting

### Impact

**Cache token counts (reads + writes) are exactly 2x Anthropic's actual values.**
Output token counts are inflated by ~6-38%.

This causes overbilling in our usage tracking — edits that Anthropic bills at ~$0.015
show up as ~$0.25 in our system (17x due to doubling + cost formula amplification).

### Root Cause (Confirmed 2026-02-05)

`@langchain/anthropic@0.3.34` processes streaming events incorrectly. Anthropic's
streaming format:

```
message_start.usage:  { input_tokens: 3, cache_creation: 14997, cache_read: 0, output_tokens: 5 }
message_delta.usage:  { input_tokens: 3, cache_creation: 14997, cache_read: 0, output_tokens: 96 }
```

**`message_delta.usage` repeats ALL token counts from `message_start`** — it's cumulative,
not incremental. LangChain sums `message_start` + `message_delta`, doubling everything.

**Proof from live data** (hero headline edit, 3 Anthropic API calls):

| Source | Input | Cache Reads | Cache Writes | Output |
|--------|-------|-------------|--------------|--------|
| Anthropic console | 15 | 31,584 | 18,203 | ~1,869 |
| Our tracker | 15 | 63,168 | 36,406 | ~598* |
| Ratio | 1x | **2x** | **2x** | ~0.3x** |

\* Output appears lower because only 3 of many API calls are tracked (see Bug #3).
\*\* Input tokens are NOT doubled, likely because LangChain handles that field correctly.

### Verified math

```
Anthropic cache_reads: 0 + 14,997 + 16,587 = 31,584
Our cache_reads:                               63,168  = 31,584 × 2 ✓

Anthropic cache_writes: 14,997 + 1,590 + 1,616 = 18,203
Our cache_writes:                                 36,406 = 18,203 × 2 ✓
```

### Fix (Implemented 2026-02-05)

**Root cause in LangChain**: `@langchain/core` merges streaming chunks via `mergeUsageMetadata()`,
which SUMS `input_token_details.cache_creation` and `cache_read` from both `message_start` and
`message_delta`. But `response_metadata` is merged via `_mergeDicts` — and `message_delta` sets
`response_metadata: undefined`, so the `message_start` values are preserved untouched.

**Fix in `tracker.ts`**: Read cache tokens from `response_metadata.usage` (raw Anthropic data,
not merged) instead of `usage_metadata.input_token_details` (merged/doubled). Falls back to
`usage_metadata` for non-Anthropic providers (OpenAI, Groq).

```typescript
const rawAnthropicUsage = (message as any).response_metadata?.usage;

cacheCreationTokens:
  rawAnthropicUsage?.cache_creation_input_tokens ??
  usage.input_token_details?.cache_creation ?? 0,
cacheReadTokens:
  rawAnthropicUsage?.cache_read_input_tokens ??
  usage.input_token_details?.cache_read ?? 0,
```

This is safe — if LangChain fixes the bug upstream, `response_metadata.usage` will still
contain the correct values (it's always the raw Anthropic data). No fragile halving logic.

---

## 9. Bug #3: Subagent API Calls Not Tracked (Revenue Leakage)

### Impact

Our tracker captures only **3 of 17+ actual API calls** during an edit run. The coder
subagent's LLM calls bypass our `UsageTrackingCallbackHandler`, meaning ~82% of
Anthropic billing is invisible to our billing system.

### Root Cause

The `deepagents` framework creates subagent model instances that don't inherit the
parent model's callback handlers. Our `usageTracker` callback is attached via
`StructuredOutputRunnableBinding.configFactories`, but when `deepagents` creates
the coder subagent, it may instantiate its own model or strip the binding.

### Evidence

HAR recording analysis of the edit run shows:
- 8+ API calls from the main agent (tool loop turns)
- 9+ API calls from coder subagent (3 sessions × 3 turns each)
- Our tracker only records 3 calls total

### Fix Options

1. **Attach callback at the LLM level** — Use `ChatAnthropic.callbacks` instead of
   `configFactories` on the wrapper, so subagents inherit the callback.

2. **Use deepagents middleware for tracking** — Write a deepagents-compatible middleware
   that captures usage for all LLM calls including subagent calls.

3. **Track at the HTTP level** — Intercept Anthropic API responses directly (via fetch
   wrapper or Hono middleware) to guarantee 100% capture regardless of LangChain internals.

**Recommended**: Option 3 for reliability. LangChain wrappers are fragile; HTTP-level
tracking is the only approach that guarantees complete capture.

---

## 10. Priority Action Items

### Step 1: Fix token double-counting (Bug #2)

**Goal**: Our tracked costs match Anthropic's actual costs.

1. Create a `pnpm patch` for `@langchain/anthropic@0.3.34`
2. In the streaming handler, fix usage aggregation to not double-count cache tokens
3. Run the website builder test and verify `logCostSummary` matches Anthropic console
4. Verify: for a hero edit, cost should be ~2,500 mc ($0.025), not ~25,000 mc ($0.25)

### Step 2: Fix subagent tracking (Bug #3)

**Goal**: All API calls are captured, not just 3 of 17.

1. Add HTTP-level usage tracking (intercept Anthropic API responses)
2. Cross-reference with Anthropic console to verify 100% capture
3. Re-run the website test and verify LLM call count matches actual API calls

### Step 3: Fix prompt caching (Bug #1)

**Goal**: Cache reads replace cache writes after first call, reducing per-edit cost.

1. Unwrap `StructuredOutputRunnableBinding` before passing to `createDeepAgent`
2. OR patch `anthropicPromptCachingMiddleware` to recognize wrapped models
3. Verify: Anthropic console should show `cache_read > 0` on turns 2+
4. Expected: edit cost drops from ~$0.015 to ~$0.005 per call with cache hits

### Step 4: Reduce subagent context bloat

**Goal**: Subagent calls don't re-send the full parent context.

1. Audit what context the coder subagent receives — does it get the full 15k+ system prompt?
2. Trim subagent context to only what's needed for the delegated task
3. Route subagents to Haiku where quality allows (3.75x cheaper input)

### Step 5: Enable summarization middleware

**Goal**: Prevent context from growing unboundedly in long conversations.

1. Uncomment `summarizationMiddleware` in `agent.ts`
2. Configure trigger at 70% of context window
3. Test quality impact on edits

---

## 11. Projected Savings (Updated)

| Scenario | Per-Edit Cost | Daily Cost | vs Current |
|----------|--------------|-----------|------------|
| Current (broken tracking + no caching) | ~$0.25* | $45 | — |
| Fix double-counting only | ~$0.015 | $45† | Accurate billing |
| + Fix caching | ~$0.005 | $15-25 | 45-67% savings |
| + Haiku subagents | ~$0.003 | $12-20 | 56-73% savings |
| + Fewer turns + summarization | ~$0.002 | $5-10 | 78-89% savings |

\* Our tracked cost, not actual Anthropic cost
† Actual Anthropic spend unchanged — we just stop overbilling users

### Cache TTL Note

Anthropic offers **5-minute** and **1-hour** cache TTLs:
- 5m: Standard ephemeral cache. Included in `cache_writes` price ($6/M for Sonnet).
- 1h: Extended cache. Costs 2x the 5m rate but persists longer.
- Our middleware uses 5m. For edit-heavy sessions where users make multiple quick edits,
  5m is sufficient since edits happen within minutes of each other.
