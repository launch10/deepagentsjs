# Website Streaming Experiments

## Current Understanding (updated after Experiment 7 + deepagents analysis)

### What works
- **SSE pipeline is fully functional.** 2,672 chunks over 155s. First chunk at 24ms (no buffering).
- **Subagent interleaving FIXED (messages).** `isSubagentNamespace()` in the SDK correctly filters subagent chunks from `RawMessageHandler` and `OtherToolHandler` using `checkpoint_ns`. 4,128 chunks filtered, 2,504 passed. No subagent text leaks to the user.
- **Todos populate during execution.** The LLM now calls `write_todos` (8 todos created). `todoOverrideMiddleware` is working.
- **Files arrive during execution.** `data-state-files` chunks arrive as an Object (not array) mid-stream.
- **State streaming works.** `data-state-*` chunks (chatId, status, todos, files) flow through correctly.
- **Todos flicker ROOT CAUSE FOUND AND PATCHED.** See Experiment 7 below. `MiddlewareNode.invokeMiddleware` in langchain was spreading `...state` when hooks returned `void 0`, re-emitting every state key. Fixed via `pnpm patch langchain@1.2.17`.

### What's broken

| # | Problem | Root Cause | Severity |
|---|---------|-----------|----------|
| 1 | **Text arrives as wall, not streamed** | First `data-content-block-text` at chunk #2500 @148s. Parent agent's greeting + summary arrives as one dump at the end, not token-by-token during execution. | High — no progressive text UX |
| 2 | **~~Todos flicker to empty~~** | **FIXED.** Root cause: `MiddlewareNode.invokeMiddleware` in langchain spreads `...state` when a middleware hook returns `void 0`. Patched via `pnpm patch langchain@1.2.17`. | ~~High~~ → **FIXED** |
| 3 | **Text squished together** | Parent agent's response has no newlines between sections. All text from different response parts concatenated without spacing. | Medium — ugly but readable |
| 4 | **History reload shows perpetual spinner** | After page refresh, "Getting ready..." spinner never resolves. Page preview loads but sidebar stays in loading state. | High — broken reload |
| 5 | **~~Todos lost on reload~~** | Likely fixed — end-of-stream wipe was caused by same root as #2. Needs verification. | ~~Medium~~ → **Verify** |
| 6 | **MAYBE INIT fires repeatedly** | `useWebsiteInit` useEffect fires 13+ times before stream starts (BuildStep.tsx:46). Not harmful but wasteful. | Low — cosmetic log spam |
| A | **Subagent state leaks to parent stream** | `BaseStateHandler` forwards ALL `updates` stream chunks including subagent-namespaced ones. Subagent's own `todoListMiddleware.after_model` emits `todos: []` (the subagent's empty todo list) which gets misinterpreted as "parent todos are now empty." Need to add `isSubagentNamespace()` check to `BaseStateHandler.handle()` the same way `RawMessageHandler` and `OtherToolHandler` already filter. | High — parent state corruption |
| B | **Preview fails: export mismatches** | LLM generates components with `export default` but IndexPage uses named imports `{ Component }`. Code generation quality issue. **Plan:** Surface WebContainer console errors to user via existing log event system → either prompt "fix it?" or auto-submit to backend. | High — broken preview |
| C | **tailwind.config.ts syntax error** | `import type { Config }` in a `.ts` file required via CJS. Same fix path as B — surface errors, let agent fix. | Medium — contributes to broken preview |

### Architecture facts confirmed
- `runStateOnly` is the code path for initial website generation (not `sendMessage`)
- `isSubagentNamespace()` checks `checkpoint_ns` for `tools:` segments — this is the correct filter
- Parent agent chunks have namespace like `run:...|default:...|websiteBuilder:...|model_request:...` (no `tools:`)
- Subagent chunks have `tools:XXXX` in namespace — correctly filtered
- LangGraph `updates` stream mode only includes keys a node explicitly returned (confirmed via SDK tests)
- `MiddlewareNode.invokeMiddleware` was spreading `...state` on `void 0` returns, causing phantom state re-emissions — **patched**
- **Subagent has its own `todoListMiddleware`** with its own `todos` channel starting at `[]`. This is NOT the subagent saying "I finished a parent todo" — it's internal bookkeeping noise. `EXCLUDED_STATE_KEYS` prevents this at the LangGraph state level, but the stream handler doesn't enforce the same boundary yet.
- **Parent owns its todo list.** Subagent completion flows back through messages, not the todos channel. Parent reads completion messages and calls `write_todos`/`update_todos` to update progress.
- **`BaseStateHandler.handle()` already detects subgraph chunks** via `Array.isArray(chunk[0])` at line 476 (namespace is `chunk[0]`), but never checks `isSubagentNamespace()` — just extracts data and forwards it.

### Next steps (prioritized)

1. **Fix subagent state leak in `BaseStateHandler`** — Add `isSubagentNamespace(chunk[0])` guard at top of `BaseStateHandler.handle()`. Same pattern as `RawMessageHandler`. One-line fix at the right architectural layer.
2. **Surface WebContainer errors to user (B/C)** — WebContainerManager already emits `{ type: "log", message }` events. Vite errors like "No matching export" flow through there. Need to: (a) detect error patterns in log events, (b) surface to user as "We encountered a build error", (c) either auto-submit fix request to backend or show a "Fix it?" button.
3. **Progressive todo updates** — Not a streaming bug. The parent agent should call `update_todos` as it receives completion messages from subagent. Prompt/orchestration change.

---

## Experiment 6: Subagent interleaving fix verification

**Status**: Complete
**Date**: 2026-02-10

### Changes made
- `langgraph-ai-sdk/src/stream.ts`: Added `isSubagentNamespace()` filter in `RawMessageHandler` and `OtherToolHandler` (checks `checkpoint_ns` for `tools:` segments)
- Re-added diagnostic logging: RawMessageHandler (filtered/passed counts + previews), BaseStateHandler (todos/files detail), StreamHandler (summary)
- `langgraph-ai-sdk-react/src/langgraphChat.ts`: Re-added `runStateOnly` chunk timing, type counts, data preview

### Results

**Backend interleaving filter:**
```
[StreamHandler] DONE | RawMessage: 2504 passed, 4128 filtered (subagent)
```
- 62% of raw message chunks were subagent text → correctly suppressed
- All 10 logged FILTERED chunks had `tools:` in their namespace
- All 5 logged PASSED chunks had `model_request:` namespace (no `tools:`)
- Subagent content correctly filtered: file reads, directory listings, code content

**Frontend chunk timeline:**
```
#1     @24ms     data-custom-notify-task-start
#2-5   @144ms    notify task complete, chatId, etc.
#500   @40s      tool-input-available (tool streaming)
#1000  @49s      tool-input-available
#1500  @67s      tool-input-available
#2000  @125s     tool-input-available
#2500  @148s     data-content-block-text ← FIRST text! "I'll help you create..."
#2672  @155s     DONE
```

**Type count breakdown (2,672 total chunks):**
- `tool-input-available`: 2,179 (82%) — tool call arg streaming
- `data-content-block-text`: 292 (11%) — actual user-visible text
- `data-message-metadata`: 68
- `data-state-todos`: 31
- `data-state-files`: 11
- `data-custom-notify-*`: 18
- Everything else: ~73

**Todos lifecycle (backend):**
```
17:14:22  todoListMiddleware.after_model → todosCount: 0  (early model calls)
17:14:25  todoListMiddleware.after_model → todosCount: 0
17:14:31  tools → todosCount: 8                            ← write_todos called!
17:14:31  todoListMiddleware.after_model → todosCount: 8   ← picked up
...
17:16:10  todoListMiddleware.after_model → todosCount: 8
17:16:10  tools → todosCount: 8                            ← update_todos
17:16:51  websiteBuilder → todosCount: 0                   ← WIPE at end
17:16:51  default → todosCount: 0                          ← WIPE at end
17:16:51  run → todosCount: 0                              ← WIPE at end
```

**Frontend todos observed (BuildStep.tsx):**
```
undefined → Array(0) → Array(8) → Array(0) → Array(8) → ... → Array(0)  ← ends empty
```

**Text quality:**
Parent agent text arrives in 292 chunks but all at once at the end (~148s). Content is concatenated without newline separators between logical sections (greeting, exploration summary, delegation intro, final summary).

---

## Experiment 7: Verify todos flicker fix + remaining issues

**Status**: Complete
**Date**: 2026-02-10

### Changes made (before running)
- **`pnpm patch langchain@1.2.17`** — Fixed `MiddlewareNode.invokeMiddleware` line 70-73. When a middleware hook returns `void 0` (no changes), it was returning `{ ...state, jumpTo: void 0 }` which re-emitted every state key as an update. Fixed to return `{ jumpTo: void 0 }` (empty update).
- **SDK tests** — 5 tests in `todos-flicker.test.ts` confirming updates stream only includes explicitly returned keys. All pass.
- **Diagnostic logging still in place** — RawMessageHandler filtered/passed, BaseStateHandler todos/files, StreamHandler summary, runStateOnly chunk timing.

### Results

**Todos flicker: FULLY FIXED.**
```
node="tools"          key="todos" | todosCount: 8
node="tools"          key="todos" | todosCount: 8
node="tools"          key="todos" | todosCount: 8
node="websiteBuilder" key="todos" | todosCount: 8   ← was 0 before patch!
node="default"        key="todos" | todosCount: 8   ← was 0 before patch!
node="run"            key="todos" | todosCount: 8   ← was 0 before patch!
```
- Zero `todosCount: 0` emissions anywhere
- `todoListMiddleware.after_model` no longer appears in state logs at all (its hooks return `void 0` → now empty update)
- End-of-stream nodes (`websiteBuilder`, `default`, `run`) also fixed — they were also victims of the `...state` spread bug
- Frontend confirms: `todos: (8) [{…}, ...]` arrives and stays stable

**Files: arrive but preview fails.**
- Files emitted correctly: 6× `node="tools" key="files" | filesCount: non-array`
- Frontend receives: `files: {components.json: {…}, eslint.config.js: {…}, index.html: {…}, ...}`
- WebContainer mounts files and starts Vite
- **BUT: generated code has export mismatches** — LLM used default exports but IndexPage imports named exports:
  ```
  No matching export in "src/components/Problem.tsx" for import "Problem"
  No matching export in "src/components/Features.tsx" for import "Features"
  No matching export in "src/components/SocialProof.tsx" for import "SocialProof"
  No matching export in "src/components/CTA.tsx" for import "CTA"
  No matching export in "src/components/Footer.tsx" for import "Footer"
  ```
- Also: `tailwind.config.ts` has `import type { Config }` syntax error when required via CJS

**Stream stats:**
```
[StreamHandler] DONE | RawMessage: 2206 passed, 4361 filtered (subagent)
```
- 27 LLM calls, ~2.5 min execution
- Interleaving filter still working correctly

### New issues found

| # | Problem | Root Cause | Fix approach |
|---|---------|-----------|-------------|
| A | **Subagent state leaks to parent stream** | Subagent has its own `todoListMiddleware` with `todos: []`. `BaseStateHandler` forwards ALL `updates` chunks — no namespace filter. The subagent's internal bookkeeping (`todos: []`) gets forwarded as if the parent's todos were cleared. `EXCLUDED_STATE_KEYS` enforces this boundary at the LangGraph state level, but the stream handler doesn't match it. | Add `isSubagentNamespace(chunk[0])` guard at top of `BaseStateHandler.handle()`. Same pattern as `RawMessageHandler`. |
| B | **Preview fails: export mismatches** | LLM generates components with `export default` but IndexPage uses named imports `{ Component }`. Code generation quality issue. | Surface WebContainer console errors to user. Either "Fix it?" button or auto-submit to backend. Manager already emits `{ type: "log" }` events with Vite output. |
| C | **tailwind.config.ts syntax error** | `import type { Config }` in a `.ts` file required via CJS. WebContainer Vite chokes on it. | Same fix path as B — surface errors, let agent self-correct. |

### Remaining issues (from before)
- **Text arrives as wall** — parent agent writes text at start + end, nothing during 130s of tool calls
- **Text squished** — no newlines between sections
- **History reload spinner** — untested this experiment (need to reload to check)
- **Todos on reload** — untested (need to reload to check, but likely fixed since end-of-stream wipe is gone)

---

## Experiment 5: Frontend SSE diagnostic logging

**Status**: Complete
**Date**: 2026-02-10

### Changes made
- `langgraph-ai-sdk-react/src/langgraphChat.ts` (`runStateOnly`): Chunk timing, type counting, data preview
- `langgraph-ai-sdk/src/stream.ts` (`RawMessageHandler`): Agent name, node, parentDepth per chunk
- `langgraph-ai-sdk/src/stream.ts` (`BaseStateHandler`): State key logging with todos/files detail

### Results

**Frontend SSE consumption:**
```
firstChunkDelayMs: 8         ← NOT buffered
totalChunks: 4352
totalTimeMs: 204701 (205s)

Chunk timing (progressive, with bursts):
  #1    @8ms       data-custom-notify-task-start
  #10   @1580ms    data-content-block-text  ← first text!
  #50   @4376ms    (todos: [] arrives in state)
  #100  @8606ms
  #200  @27043ms   (burst: #200-400 within ~100ms)
  ...
  #4250 @202098ms  (files arrive: 71 files)
  #4352 @204701ms  DONE
```

**State updates during execution:**
- `data-state-chatId` ✓ (arrives early)
- `data-state-status` ✓ (arrives early)
- `data-state-todos` ✓ (arrives early, but value is always `[]`)
- `data-state-files` ✓ (arrives during execution, but `filesCount: 0` until the very end)
- Files arrive at the end with 71 files when `websiteBuilderNode` reads from DB

**Backend RawMessageHandler:**
- All 15 logged chunks: `langgraph_node: 'model_request'`, `agentName: 'unknown'`
- No way to distinguish parent vs subagent from metadata alone
- Both parent and subagent tokens have `notify` tag → all stream

**Todos mystery solved:**
```
[STATE data-state] node="todoListMiddleware.after_model" keys=[todos]
  hasTodos: true, todosValue: 'array(0)'    ← empty every time
```
The todoListMiddleware fires after EVERY model call but the LLM never calls `write_todos`. The todo data simply doesn't exist. This is a deepagents/prompt issue, not a streaming issue.

---

## Earlier Experiments (1-4)

### Experiment 1: Baseline Observation
**Status**: Complete | **Date**: 2026-02-10 | **LangSmith Trace**: `750948fa-cf09-41f7-a878-5103396b3a08`

- 31 LLM calls, all with `notify` tag. 188s execution.
- Nothing appeared to stream (later found: text WAS streaming but interleaved with subagent chatter)
- `MAYBE INIT` fires repeatedly (useEffect instability — separate issue)

### Experiment 2: Config comparison
**Status**: Complete | **Date**: 2026-02-10

- Config spread vs Object.assign: identical properties. Spread was NOT the issue.
- Messages mode chunks DO arrive with `notify` tag — inner agent tokens propagate correctly.

### Experiment 3: RawMessageHandler gate logging
**Status**: Complete | **Date**: 2026-02-10

- All chunks PASS through RawMessageHandler. Real text content written to SSE.
- Backend pipeline fully confirmed working.

### Experiment 4: Frontend verification
**Status**: Complete | **Date**: 2026-02-10

- Discovered `runStateOnly` is the code path (not `sendMessage`)
- Led to adding frontend logging in Experiment 5

---

## Changes currently in place (to be cleaned up)

### `patches/langchain@1.2.17.patch` (ROOT CAUSE FIX — keep)
- Fixes `MiddlewareNode.invokeMiddleware`: `void 0` returns no longer spread `...state`
- Registered in root `package.json` under `pnpm.patchedDependencies`

### `packages/langgraph-ai-sdk/.../src/__tests__/todos-flicker.test.ts` (keep)
- 5 tests verifying updates stream only includes explicitly returned keys
- Tests intentional clear, content updates, no phantom emissions

### `langgraph_app/app/nodes/coding/agent.ts`
- Changed `{ ...options.config, recursionLimit }` → `Object.assign(originalConfig, { recursionLimit })`

### `packages/langgraph-ai-sdk/.../stream.ts` (diagnostic — remove after verification)
- `RawMessageHandler`: FILTERED/PASSED logging with namespace, node, preview (rate-limited)
- `OtherToolHandler`: FILTERED subagent logging (first 5)
- `BaseStateHandler`: State key logging for todos/files (+ first 5 other keys)
- `LanggraphStreamHandler.stream()`: Summary log at end of stream

### `packages/langgraph-ai-sdk-react/.../langgraphChat.ts` (diagnostic — remove after verification)
- `runStateOnly`: Chunk timing, type counts, data preview (first 5 + every 500th + summary)

### `rails_app/.../BuildStep.tsx`
- Console.log of files, todos, messages on every render (pre-existing debug logging)
