# Deep Agent Cost Investigation & Optimization

## Goal

Establish a baseline understanding of deep agent costs, identify the biggest cost drivers, and systematically test optimization levers. Engineer-first: measure before optimizing.

---

## Phase 1: Establish the Baseline (Measurement)

### Step 1: Verify billing is saved correctly for deep agent calls

**Status:** BUG FOUND — output tokens are overcounted

#### What works

- `usageTrackingIntegration.test.ts` has "Deep agent usage tracking" describe block
- `llm_usage` records ARE created for every LLM call inside deep agents
- All records correctly share the same `runId`
- Multi-turn tool loops create multiple records (1 per LLM call)
- **Input tokens are accurate** (match Anthropic dashboard exactly)

#### Bug: LangChain double-counts output tokens during streaming

**Root cause:** `@langchain/anthropic@0.3.34` in `utils/message_outputs.js`

Anthropic's streaming API sends two usage events per request:

1. `message_start.usage.output_tokens` — partial count at stream start (e.g. 21)
2. `message_delta.usage.output_tokens` — **cumulative total** at stream end (e.g. 55)

LangChain creates a chunk from each event with `usage_metadata.output_tokens` set to each value, then concatenates chunks by **adding** them: `21 + 55 = 76`. But the correct total is just `55` (the `message_delta` value is cumulative, not incremental).

Input tokens are NOT affected because `message_delta` hardcodes `input_tokens: 0`, so `7873 + 0 = 7873` is correct.

**Evidence from HAR recording** (deep-agent-with-tools test, haiku calls):

| API Call                     | message_start.output_tokens | message_delta.output_tokens | LangChain reports | Anthropic dashboard (truth) | Error |
| ---------------------------- | --------------------------- | --------------------------- | ----------------- | --------------------------- | ----- |
| msg_01NUEAbkeXUEVJgvGZKonCL3 | 21                          | 55                          | **76**            | **55**                      | +38%  |
| msg_01FRzsF2HX3LDFFntZyCJPut | 1                           | 16                          | **17**            | **16**                      | +6%   |

The overcount varies per call because `message_start.output_tokens` varies (it represents tokens pre-filled at stream start). Tool-use calls tend to have higher `message_start` values, so they're overcounted more.

**How the tracker gets the wrong number:** Our tracker (`tracker.ts:167`) reads `message.usage_metadata.output_tokens`, which is the already-incorrect concatenated value from LangChain.

**Affected code path:**

1. `@langchain/anthropic/dist/utils/message_outputs.js:15-18` — `message_start` handler puts `output_tokens` in chunk
2. `@langchain/anthropic/dist/utils/message_outputs.js:40-43` — `message_delta` handler puts cumulative `output_tokens` in chunk
3. `@langchain/anthropic/dist/chat_models.js:831` — `finalChunk.concat(chunk)` adds them together
4. `app/core/billing/tracker.ts:167` — reads the inflated `usage_metadata.output_tokens`

**Fix options:**

1. **pnpm patch** `@langchain/anthropic` — zero out `output_tokens` in the `message_start` usage_metadata (cleanest immediate fix, `patches/` dir already exists)
2. **Upgrade to `@langchain/anthropic@1.x`** — latest is 1.3.10, may have fixed this (major version jump, needs compatibility check)
3. **Fix in tracker** — read from raw API response instead of `usage_metadata` (harder, raw tokens aren't easily accessible after LangChain processing)

**Impact:** We are overcharging customers on output tokens. The magnitude depends on the `message_start.output_tokens` value, which varies per call. For tool-use heavy flows (like deep agents building websites), this could be significant.

#### How usage tracking actually works (for reference)

The usage records do NOT come from the messages visible in `result.messages`. They come from the **LangChain callback system**:

1. `getLLM()` (`llm.ts:107-124`) wraps every model in a `StructuredOutputRunnableBinding` with `configFactories` that inject the `usageTracker` callback handler
2. When any LLM call completes (including inside deep agent subgraphs), LangChain fires `handleLLMEnd` on the callback handler
3. `UsageTrackingCallbackHandler.handleLLMEnd` (`tracker.ts:55-100`) extracts `usage_metadata` from the `AIMessage` and pushes a `UsageRecord` into the `AsyncLocalStorage` context
4. `AsyncLocalStorage` propagates the context through `agent.invoke()` calls, so deep agent LLM calls write to the same context as the parent
5. When the stream completes, `usageTrackingMiddleware` (`usageTracking.ts`) persists the accumulated records to the `llm_usage` table

The messages in `result.messages` are the LangGraph state messages (the deep agent node's return value). Their `response_metadata.usage` only contains cache fields because `input_tokens`/`output_tokens` are destructured out in the `message_start` handler — they go into `usage_metadata` instead of `response_metadata`.

### Step 2: Verify multi-tool-call-per-turn aggregation

**What:** Confirm that when the agent makes parallel tool calls in a single turn, we correctly count this as 1 LLM call (1 turn) with N tool executions, not N separate billing records.
**How:**

- Query the HAR recording to count actual Anthropic API requests vs `llm_usage` rows
- Write a test: deep agent with 3 tools, prompt that triggers parallel tool calls, assert `llm_usage` count matches API call count (not tool call count)
- Check: does `usageSummary.llmCallCount` reflect turns or individual records?

**Key files:**

- `app/core/billing/tracker.ts` — `handleChatModelStart` / `handleLLMEnd` (1 record per LLM response, not per tool call)
- `app/core/billing/persist.ts:33-51` — `prepareUsageRecordsForInsert`
- `app/api/middleware/usageTracking.ts:92` — `llmCallCount: records.length`

### Step 3: Count turns for 1 website create

**What:** Parse the existing HAR recording to understand how many LLM turns the coding agent takes to build one website.
**How:**

- Parse `tests/recordings/website-builder_4064829088/recording.har` (59MB, 1,260 Anthropic API calls)
- Write a script that extracts: number of Anthropic API calls, input/output tokens per call, cumulative input tokens across turns, tool_calls per response
- Build a CSV/table: `turn_number | input_tokens | output_tokens | cumulative_input | tool_calls_in_response | tool_names`
- This gives us the "turn profile" — where does context explode?

Answer: 50-75

**Deliverable:** A turn-by-turn cost profile showing the growth curve.

### Step 4: Calculate actual cost of 1 website create

**What:** Sum real token costs from the HAR data or from `llm_usage` table.
**How:**

- From HAR: sum `input_tokens * input_price + output_tokens * output_price` per model
- From DB: `SELECT SUM(inputTokens), SUM(outputTokens) FROM llm_usage WHERE threadId = ?`
- Calculate: total cost at Anthropic pricing (Sonnet 4.5: $3/1M input, $15/1M output)
- Compare: what would it cost with prompt caching? (cache_read tokens are much cheaper)

Answer: $1.50 - $2.00

**Deliverable:** Dollar cost per website create, broken down by phase.

### Step 5: Debug Cost of Edits

Both editing the headline + the CTA have cost us roughly $0.20-25 each. This is prohibitively expensive for edits.

We need to understand what is getting cached here, and whether prompt trimming, etc. might be cheaper.

=== Hero Edit Cost Summary ===
LLM calls: 3
Input: 17 tokens × $3.00/M = 5 mc
Output: 598 tokens × $15.00/M = 897 mc
Cache reads: 65,226 tokens × $0.30/M = 1,957 mc
Cache creation: 36,104 tokens × $6.00/M = 21,662 mc
Total: 24,522 millicredits = $0.2452
==============================

---

## Phase 2: Debug Observability Issues

### Step 5: Why is LangSmith visualization not working for deep agents?

**What:** LangSmith env vars are set (`LANGSMITH_TRACING=true`) and LangChain auto-enables tracing. But deep agent runs don't appear properly.
**Hypothesis:** `createDeepAgent` internally calls `createAgent` which creates its own `StateGraph.compile()`. This inner graph may not inherit the parent's LangChain callbacks/tracing context. The `recursionLimit: 10000` config is set but tracing config may not propagate.
**How:**

- Check if LangSmith traces appear at all (even partial) for deep agent runs
- Compare: do direct `getLLM().invoke()` calls appear in LangSmith? (from brainstorm agent, which doesn't use deepagents)
- Check: does the `config` object passed to `agent.invoke()` in `websiteBuilder.ts:78-86` include LangChain's tracing callbacks?
- Test: explicitly pass `callbacks` in the config to `agent.invoke()` and see if traces appear

**Key files:**

- `app/nodes/website/websiteBuilder.ts:78-86` — where config is passed to deep agent
- `app/core/llm/llm.ts:100-124` — configFactories that attach callbacks

### Step 6: Debug duplicated tool usage (reading/writing same file 3x)

**What:** The agent sometimes reads or writes the same file multiple times in consecutive turns. Is this a WebsiteFilesBackend bug or an agent behavior issue?
**How:**

- Parse HAR recording to extract all tool_call names and arguments across turns
- Build a report: `file_path | operation | turn_number` — highlight consecutive duplicates
- Check WebsiteFilesBackend: does `read()` always return current content? Could stale reads cause re-reads?
- Check: after `write()` completes, does the agent re-read to verify? (The edit workflow prompt says "Verify: Read the modified files back")
- Check: are subagents re-reading files the parent already read? (context not shared)

**Key files:**

- `app/services/backends/websiteFilesBackend.ts` — `read()` at line 122, `write()` at line 237
- `app/prompts/coding/shared/workflow.ts` — edit workflow step 8 says "Verify: Read the modified files back"
- HAR recording — tool call patterns

---

## Phase 3: Understand the Agent's Decision-Making

### Step 7: Think like the agent — what does it see?

**What:** To understand why the agent makes the decisions it makes, we need to reconstruct what it sees at each turn. Every turn, the agent receives: system prompt + full message history + tool results.
**How:**

- From HAR, extract the full `messages` array sent to Anthropic at turn 1, turn 10, turn 30, turn 50
- Measure: how much of the context is system prompt vs. conversation history vs. tool results?
- Identify: which tool results are the largest? (file reads? grep results?)
- Check: is the agent re-reading files whose content is already in the message history from a previous read?
- Check: what percentage of context is "stale" (tool results the agent won't need again)?

**Deliverable:** Context composition breakdown at key turns (pie chart: system prompt vs tool results vs conversation vs AI responses).

### Step 8: What would the agent need to see to make different decisions?

**What:** Based on Step 7, identify what prompt changes or context changes would reduce turns.
**Analysis areas:**

- **Create flow:** Does the agent explore the template before writing? Should it?
- **Subagent delegation:** Are subagents re-reading files the parent already read? Could we inject file contents?
- **Parallel tool calls:** Is the agent batching reads, or doing them one at a time?
- **Verify step:** Is the "read back to verify" step worth the extra turn? Could we remove it?
- **Write vs edit:** Is the agent using `edit_file` when `write_file` would be more efficient (one turn vs multiple)?

---

## Phase 4: Test Optimization Levers

### Step 9: Quick wins — existing middleware

**What:** Test whether shipped langchain middleware can reduce costs without code changes.

| Middleware                                     | What it does                                              | Expected impact                                | Test approach                                                     |
| ---------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| `contextEditingMiddleware` (ClearToolUsesEdit) | Replaces old tool results with `[cleared]` at 100k tokens | Reduces context size per turn in long sessions | Add to coding agent middleware, re-run test, compare token counts |
| `toolCallLimitMiddleware`                      | Per-tool or global limits                                 | Safety net against runaway                     | Add `runLimit: 50` as safety net                                  |
| `modelCallLimitMiddleware`                     | Limits LLM turns                                          | Hard stop on cost                              | Add `runLimit: 40, exitBehavior: "end"`                           |

**Key file to modify:** `app/nodes/coding/agent.ts:26-37` (getMiddlewares function)

### Step 10: Prompt engineering — reduce turns

**What:** Modify prompts to encourage fewer, more productive turns.
**Changes to test:**

- Remove "Verify" step from edit workflow (`app/prompts/coding/shared/workflow.ts:37`)
- Add anti-re-read rule: "NEVER re-read a file you already read. Its content is in the conversation above."
- Add batching rule: "Read ALL files you need in ONE message. NEVER read-think-read."
- For create flow: "You are writing files from scratch. Do NOT read template files before writing — just write."

### Step 11: Evaluate Claude SDK / Anthropic agent alternatives

**What:** Check if Anthropic's native agent SDK (if it exists) would be more efficient than the langchain/deepagents stack.
**How:**

- Research: does Anthropic have a native agent loop SDK (not just the API)?
- Compare: would `@anthropic-ai/sdk` with manual tool loop be cheaper? (fewer abstraction layers, less prompt overhead)
- Check: does Claude have special training on any agent framework prompts? (e.g., does it respond better to certain tool-use patterns?)
- Measure: how much token overhead does the deepagents system prompt add? (todoList, filesystem, subagent prompts)

---

## Phase 5: Implement & Verify

### Step 12: Implement top optimizations

Based on findings from Phases 1-4, implement the changes with highest impact-to-effort ratio.

### Step 13: A/B comparison

Re-run the website builder test with optimizations enabled. Compare:

- Total LLM turns (target: 50% reduction)
- Total input tokens (target: 40% reduction)
- Total cost (target: 50% reduction)
- Output quality (same or better)

---

## Execution Order

**Immediate (data gathering, no code changes):**

1. Step 3: Parse HAR for turn profile (biggest insight, zero risk)
2. Step 4: Calculate actual cost
3. Step 7: Reconstruct agent's view at key turns

**Next (debugging):** 4. Step 5: LangSmith visualization 5. Step 6: Duplicate tool usage analysis 6. Step 2: Multi-tool-call aggregation verification

**Then (experiments):** 7. Step 8: Analysis of what agent needs to see differently 8. Step 9: Quick middleware tests 9. Step 10: Prompt engineering 10. Step 11: SDK alternatives research

**Finally (implementation):** 11. Step 12: Implement winners 12. Step 13: A/B comparison

---

## Key Files Reference

| File                                                        | Purpose                                      |
| ----------------------------------------------------------- | -------------------------------------------- |
| `tests/recordings/website-builder_4064829088/recording.har` | 59MB HAR with 1,260 API calls — the raw data |
| `app/core/billing/tracker.ts`                               | Usage callback handler                       |
| `app/core/billing/persist.ts`                               | DB persistence                               |
| `app/api/middleware/usageTracking.ts`                       | Bridge-level usage tracking                  |
| `app/nodes/coding/agent.ts`                                 | Coding agent creation (middleware config)    |
| `app/nodes/website/websiteBuilder.ts`                       | Where agent.invoke() happens                 |
| `app/prompts/coding/shared/workflow.ts`                     | Create/edit/bugfix workflows                 |
| `app/services/backends/websiteFilesBackend.ts`              | File backend (read/write/edit)               |
| `tests/tests/core/billing/usageTrackingIntegration.test.ts` | Billing integration tests                    |

### Key Issues:

## Token Counting

⏺ From Anthropic's console across the 3 calls:

Call 1:
Input: 3
Output: 96
Cache Read: 0
Cache Write (5m): 14997

Call 2:
Input: 6
Output: 1,592
Cache Read: 14,997
Cache Write (5m): 1590
Cache Write (1h): 0

Call 3:
Input:6
Output: 181
Cache Read: 16,587
Cache Write (5m): 1,616

Anthropic's totals (calls 1+3 only): ~0 + 14,997 = 14,997 cache reads, 14,997 +
1,590 = 16,587 cache writes

Our own totals for those calls:

=== Hero Edit Cost Summary ===
LLM calls: 3
Input: 15 tokens × $3.00/M = 0.000045
Output: 1,869 tokens × $15.00/M = 0.028035
Cache reads: 63,168 tokens × $0.30/M = 0.0189504
Cache creation: 18,203 tokens × $6.00/M = 0.109218
Total: 0.1562484
==============================

=== Hero Edit Cost Summary ===
LLM calls: 3
Input: 15 tokens × $3.00/M = 5 mc
Output: 1,869 tokens × $15.00/M = 2,819 mc
Cache reads: 31584 tokens × $0.30/M = 9,475 mc
Cache creation: 18,203 tokens × $6.00/M = 109,218 mc
Total: 121,517 millicredits = $1.2152
==============================

Our totals (all 3 calls): 65,226 cache reads, 36,104 cache writes

Even accounting for call 2, our numbers are way too high. Either call 2 has a
massive prompt, or we're double-counting tokens. Let me check the token extraction
code and the streaming behavior.

Current State

- Custom createPromptCachingMiddleware adds cache_control to the last user
  message only
- Deepagents' built-in anthropicPromptCachingMiddleware silently no-ops (can't
  unwrap StructuredOutputRunnableBinding)
- The ~15K system prompt gets NO dedicated cache breakpoint
- Result: different users don't share the system prompt cache

Problem

Without a cache breakpoint on the system prompt itself, Anthropic caches the
entire prefix (system prompt + conversation history) as one unit. Different users
(different conversations) can't share the system prompt cache, even though ~90%
of the prompt is identical.

The 3rd API call in the user's data shows 0 cache reads and 14,997 cache writes —
a complete cache miss, likely because the full prefix (including conversation
history) didn't match any existing cache entry.

Fix: Add system prompt cache breakpoint

File: langgraph_app/app/core/llm/promptCachingMiddleware.ts

Modify the middleware to also add cache_control to the system prompt:

export function createPromptCachingMiddleware(options?: {
ttl?: "5m" | "1h";
minMessagesToCache?: number;
}): AgentMiddleware {
const ttl = options?.ttl ?? "5m";
const minMessages = options?.minMessagesToCache ?? 3;

return createMiddleware({
name: "AnthropicPromptCachingMiddleware",
wrapModelCall: (request: any, handler: any) => {
if (!isAnthropicModel(request.model)) return handler(request);

       const messagesCount =
         request.state.messages.length + (request.systemPrompt ? 1 : 0);
       if (messagesCount < minMessages) return handler(request);

       let updatedRequest = { ...request };

       // 1. Add cache breakpoint to system prompt (shared across ALL users)
       if (request.systemPrompt) {
         updatedRequest.systemPrompt = addCacheControl(request.systemPrompt, ttl);
       }

       // 2. Add cache breakpoint to last user message (shared within

conversation)
const lastMessage = request.messages.at(-1);
if (lastMessage) {
const Ctor = Object.getPrototypeOf(lastMessage).constructor;
const newMessage = addCacheControlToMessage(lastMessage, Ctor, ttl);
updatedRequest.messages = [...request.messages.slice(0, -1), newMessage];
}

       return handler(updatedRequest);
     },

}) as AgentMiddleware;
}

This creates two cache breakpoints:

- Breakpoint 1 (system prompt): Shared across ALL users with the same prompt.
  ~15K tokens cached once, reused by everyone.
- Breakpoint 2 (last user message): Shared within the same conversation across
  turns.

Note: Need to verify how request.systemPrompt is formatted (string vs structured)
to add cache_control correctly. The langchain middleware uses
modelSettings.cache_control which is a different mechanism — we should
investigate whether we can use that instead for the system prompt.

---

Files to Modify

1.  langgraph_app/app/core/billing/tracker.ts — Fix cache token extraction
2.  langgraph_app/app/core/llm/promptCachingMiddleware.ts — Add system prompt
    cache breakpoint
3.  langgraph_app/tests/support/helpers/costSummary.ts — No changes needed
    (display only)
