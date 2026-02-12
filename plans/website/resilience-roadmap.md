# Website Builder Resilience — Final Roadmap

## Decisions Made

After interviewing on approach, the original 10-item plan is reduced to **4 items**:

| Original Item | Decision | Reason |
|---------------|----------|--------|
| 1. Rate limit retry middleware | **Build** | 429s are the most common user-facing failure |
| 2. Graph-level execution timeout | **Build** (hard abort via AbortSignal) | Hung runs are real; cooperative primitives can't reach a hung LLM call |
| 3. Per-run cost ceiling | **Skip** | We already have post-run billing. Killing the user's call mid-run is worse than overspending slightly. |
| 4. Stuck/loop detection middleware | **Build** | Burns tokens doing nothing; consecutive identical errors trigger detection |
| 5. Partial completion on failure | **Build** | Restructure `_createCodingAgentInternal` with try/finally so `backend.flush()` always fires |
| 6. Enhanced status (NOTIFY_PROGRESS) | **Skip** | The existing todos/notification system already covers user-facing status |
| 7-10. Sprint 2 items | **Deferred** | Ship Sprint 1, evaluate, then decide |

---

## What We Already Have

| Mechanism | File | Status |
|-----------|------|--------|
| Model unavailability fallback (503/529) | `core/llm/unavailableModelFallbackMiddleware.ts` | Production |
| Tool error surfacing → LLM self-corrects | `core/llm/toolErrorSurfacingMiddleware.ts` | Production |
| Node-level error handling | `core/node/middleware/withErrorHandling.ts` | Production |
| Agent crash durability catch | `nodes/coding/agent.ts:246-267` | Production |
| Single-shot → full agent escalation | `nodes/coding/agent.ts:292-303` | Production |
| Credit gating (pre + post) | `server/middleware/creditCheck.ts` + `graphs/shared/withCreditTracking.ts` | Production |
| 3-tier prompt caching | `core/llm/promptCachingMiddleware.ts` | Production |
| Task notifications | `core/node/middleware/withNotifications.ts` | Production |
| Token usage tracking | `core/billing/tracker.ts` | Production |
| PostgresSaver checkpointing | `core/graphParams.ts` | Production |
| Context windowing (10 turns, 40K chars) | `nodes/website/contextWindow.ts` | Production |
| Deferred batch flush + 2 retries | `services/backends/websiteFilesBackend.ts:439-498` | Production |
| Recursion limit (150 create, 100 edit) | `nodes/coding/agent.ts:318` | Production |
| Structured logging + Rollbar | `core/logger/` + `core/errors/` | Production |
| Redis distributed locks | `ext/redisLock.ts` | Production |

---

## Build Plan (4 Items)

### 1. Rate Limit Retry Middleware

**Problem:** 429s from Anthropic/OpenAI throw through to the durability catch, returning a generic error. The existing `unavailableModelFallbackMiddleware` explicitly skips 429s ("should use backoff, not fallback").

**Solution:** New `wrapModelCall` middleware that retries 429s with exponential backoff + jitter.

**Verified:** The `wrapModelCall` interface exposes `error.status` / `error.response.status` via the existing `getErrorStatus()` helper pattern in `unavailableModelFallbackMiddleware.ts`. We can detect 429s.

```
File: app/core/llm/rateLimitRetryMiddleware.ts (NEW, ~50 lines)
Modify: app/nodes/coding/agent.ts (getMiddlewares — add to array)
Modify: app/core/llm/unavailableModelFallbackMiddleware.ts (accept retriesExhausted 429s)
```

**Design:**
- Max 3 retries with exponential backoff: 1s, 2s, 4s (+ random jitter 0-500ms)
- Respect `Retry-After` header from provider response when available, capped at 10s
- Only retry 429 status codes — all other errors pass through
- Last retry exhausted → tag error with `retriesExhausted: true` and re-throw
- Error falls through to `unavailableModelFallbackMiddleware` which tries a fallback model
- If fallback also fails → durability catch
- Log each retry at warn level (provider, status, attempt number)
- Rollbar alert when all retries exhaust (user is actually impacted)

**Middleware stack position — OUTERMOST `wrapModelCall`:**
Rate limit retry wraps outside the fallback middleware. This way:
1. 429 hits rate limit middleware first → retries up to 3x
2. If exhausted, error (with `retriesExhausted` flag) reaches fallback middleware
3. Fallback middleware sees the flag, tries a different model
4. If fallback fails → durability catch

**Change to `unavailableModelFallbackMiddleware`:** Currently skips 429s. Add: if error has `retriesExhausted: true`, treat it like a 503 and attempt fallback. Raw 429s (without the flag) continue to be skipped — preserves existing behavior if rate limit middleware is ever removed.

```typescript
// getMiddlewares() in agent.ts — conceptual ordering
return [
  createToolErrorSurfacingMiddleware(),           // FIRST (existing, wrapToolCall)
  createRateLimitRetryMiddleware(),               // NEW (wrapModelCall — outermost model wrapper)
  createUnavailableModelFallbackMiddleware(),     // existing (wrapModelCall — catches after retry exhaustion)
  createStuckDetectionMiddleware(),               // NEW (wrapToolCall)
  createPromptCachingMiddleware(),                // LAST (existing, wrapModelCall)
];
```

---

### 2. Execution Timeout via AbortSignal

**Problem:** No wall-clock limit on graph execution. A hung LLM stream or deadlocked tool blocks indefinitely.

**Solution:** Pass an `AbortController.signal` to the agent's invoke config. LangGraph already propagates this through `PregelRunner.tick()` → `CONFIG_KEY_ABORT_SIGNALS` → all nested subgraphs and fetch calls. A hung HTTP connection gets cancelled at the socket level.

**Why not graceful wind-down?** We considered using `interrupt()` / `updateState()` / `Command({ resume })` to inject a "wrap up" message. But these are cooperative primitives — they require the graph to yield control. In the actual failure mode (hung LLM call), the graph never yields. `AbortSignal` is the only mechanism that can reach a stuck fetch call.

```
Modify: app/nodes/coding/agent.ts (~5 lines — add AbortController + signal to invoke config)
```

**Design:**
- Create flow: 5 minute timeout (need to verify how flow type is detected — check options/state)
- Edit flow: 3 minute timeout (same — may just use 5 min for both if detection is complex)
- Create `AbortController`, set `setTimeout(() => controller.abort(), timeoutMs)`
- Pass `signal: controller.signal` in the invoke config
- LangGraph's `PregelRunner` composes this with any internal signals via `combineAbortSignals`
- The signal propagates to LLM client fetch calls — hung connections cancelled at socket level
- The abort throws `GraphTimeoutError` (custom error class, see Error Classes section)
- Falls through to durability catch → partial completion flush (item #4)
- Clear the timeout on successful completion (`clearTimeout`) to avoid leaking timers
- No new files needed

---

### 3. Stuck/Loop Detection Middleware

**Problem:** The agent sometimes calls the same tool with the same arguments repeatedly, getting the same error each time. The 150 recursion limit is too high — by then, $1+ is wasted.

**Solution:** New `wrapToolCall` middleware that tracks consecutive identical failing tool calls.

**Verified:** The `wrapToolCall` interface exposes `request.toolCall.name`, `request.toolCall.input` (args), and we can catch errors from `handler()` to capture the error message.

```
File: app/core/llm/stuckDetectionMiddleware.ts (NEW, ~25 lines)
Modify: app/nodes/coding/agent.ts (getMiddlewares — add to array)
```

**Design — consecutive identical errors, not sliding window:**
- Track ALL tool calls (success and error)
- Maintain a consecutive-identical-error counter + the hash of the last failing call
- On each tool call:
  - If it **succeeds** → reset counter to 0 (success breaks the streak)
  - If it **fails** and `hash(toolName + JSON.stringify(args) + errorMessage)` matches previous → increment counter
  - If it **fails** with a different hash → reset counter to 1 (new error pattern)
- Counter hits 3 → throw `StuckDetectedError`
- Hash uses full error message (simple; slight variations mean the situation is actually different)
- State resets per invoke call (each `createStuckDetectionMiddleware()` call creates fresh state)
- Log at warn level when stuck detected: tool name, args summary, error message

**Why consecutive, not sliding window:** If the agent interleaves successful calls between failures (e.g., read → write(fail) → read → write(fail)), the successful reads break the streak. The agent IS trying something different. Only flag when it's literally repeating the exact same failing call back-to-back.

---

### 4. Partial Completion on Failure

**Problem:** When timeout or stuck detection fires, the durability catch returns a generic fallback message. But the backend may have dirty files — work the agent already completed that gets thrown away.

**Verified:** The backend (`agentBackend`) is scoped inside `_createCodingAgentInternal()` and is NOT accessible in the outer catch block. Needs restructuring.

```
Modify: app/nodes/coding/agent.ts (~20 lines restructure)
```

**Design:**
- Add `try/finally` inside `_createCodingAgentInternal()` around the `agent.invoke()` + `agentBackend.flush()` section
- In the `finally` block:
  - Guard with `if (agentBackend)` — backend may not exist if error happened during construction
  - Call `agentBackend.flush()` with a **fresh AbortController with 10s timeout** (the original AbortController is already aborted; flush makes HTTP calls to Rails that need their own timeout)
  - Wrap flush in its own try/catch — flush failure shouldn't mask the original error
  - Set `partialFlushSucceeded = true` on success (variable declared in outer scope)
- In the outer catch, change fallback message based on `partialFlushSucceeded`:
  - `true`: "I ran into an issue but saved the progress so far. You can review what's done and ask me to continue."
  - `false`: "I ran into an issue processing your request. Could you try again?"
- Message content change only — no metadata flags. Keep the response shape the same.

---

## Error Classes

Three custom error classes for the durability catch to distinguish failure modes:

```typescript
// app/core/errors/resilience.ts (NEW, ~15 lines)
export class StuckDetectedError extends Error { name = "StuckDetectedError"; }
export class GraphTimeoutError extends Error { name = "GraphTimeoutError"; }
export class RateLimitExhaustedError extends Error { name = "RateLimitExhaustedError"; }
```

**Priority order in durability catch** (for the rare case where multiple fire simultaneously):
1. `StuckDetectedError` — most informative, tells user what happened
2. `GraphTimeoutError` — next most informative
3. `RateLimitExhaustedError` — provider-side issue
4. Generic error — fallback

In practice, stuck detection throws synchronously during a tool call while timeout fires asynchronously, so the race is unlikely. But the priority order is good defensive coding.

---

## What We're Skipping (and Why)

| Skipping | Why |
|----------|-----|
| Per-run cost ceiling | Existing post-run billing is sufficient. Killing user's call mid-run is worse than slight overspend. |
| Enhanced status (NOTIFY_PROGRESS) | Existing todos/notification system covers user-facing status. |
| Circuit breaker state machine | Existing `unavailableModelFallbackMiddleware` handles 503/529. Full state machine is overkill at our scale. |
| SLIs/SLOs/error budgets | Not enough traffic. Users will tell us when things break. |
| Chaos engineering | Test stability before testing instability. |
| OpenTelemetry | LangSmith + Pino is enough for 2 services. |
| Content hash dedup, LangSmith metadata, structured errors, output validation | Good Sprint 2 candidates. Ship Sprint 1 first. |

---

## Files to Create/Modify

### New Files
- `app/core/llm/rateLimitRetryMiddleware.ts` (~50 lines)
- `app/core/llm/stuckDetectionMiddleware.ts` (~25 lines)
- `app/core/errors/resilience.ts` (~15 lines)

### Modified Files
- `app/nodes/coding/agent.ts` — middleware stack, AbortController timeout (~5 lines), try/finally restructure for partial completion, error priority in durability catch
- `app/core/llm/unavailableModelFallbackMiddleware.ts` — accept `retriesExhausted` 429s for fallback

---

## Middleware Stack (After Implementation)

```
Agent Middleware (getMiddlewares() in agent.ts):
  1. toolErrorSurfacingMiddleware             (existing — wrapToolCall)
  2. rateLimitRetryMiddleware                 (NEW — wrapModelCall, outermost model wrapper)
  3. unavailableModelFallbackMiddleware       (existing — wrapModelCall, now accepts retriesExhausted 429s)
  4. stuckDetectionMiddleware                 (NEW — wrapToolCall, consecutive identical errors)
  5. promptCachingMiddleware                  (existing — wrapModelCall)

Graph Invocation:
  AbortController timeout (NEW — signal passed to invoke config, propagates via PregelRunner)
    → withCreditExhaustion (existing)
      → [graph execution]

Node Middleware (existing, unchanged):
  context → notifications → error → polly → [node]

Durability Layer (restructured):
  _createCodingAgentInternal:
    try { agent.invoke() + backend.flush() }
    finally { if (backend) flush with 10s timeout }
  createCodingAgent:
    outer catch checks instanceof priority: StuckDetected > Timeout > RateLimit > generic
    returns user message based on partialFlushSucceeded flag
```

---

## Verification Plan

### Unit Tests
1. **rateLimitRetry** — mock LLM returns 429 twice then 200 → verify retries and succeeds
2. **rateLimitRetry** — mock LLM returns 429 four times → verify throws after 3 retries with `retriesExhausted` flag
3. **rateLimitRetry** — mock 429 with Retry-After: 30 → verify caps wait at 10s
4. **timeout** — mock slow agent invoke → verify AbortSignal fires and invoke throws after deadline
5. **stuck detection** — 3 consecutive identical failing calls → verify throws StuckDetectedError
6. **stuck detection** — fail, succeed, fail (same args) → verify does NOT throw (success breaks streak)
7. **stuck detection** — fail(A), fail(B), fail(A) → verify does NOT throw (different errors, not consecutive)
8. **partial completion** — mock failing run with dirty backend → verify flush called in finally with fresh 10s AbortController
9. **partial completion** — mock failing run where backend doesn't exist yet → verify no crash in finally

### Integration Test
- Run the full website builder flow with a recorded LLM response (Polly)
- Verify all middleware composes without interference
- Verify existing tests still pass (middleware is transparent to happy path)
- Smoke test: verify AbortSignal actually cancels an in-flight Anthropic API call (not just ignored)
