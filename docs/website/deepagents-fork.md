# Deepagents Fork

We maintain a fork of `deepagentsjs` at `packages/deepagentsjs` (git submodule from `git@github.com:launch10/deepagentsjs.git`). This document explains what we changed, why, and what would need to happen to upstream or remove the fork.

## Why We Forked

Upstream deepagents doesn't support a critical requirement: **parallel subagents that share progress with their parent in real time**.

When the website coding agent dispatches 7 parallel subagent tasks (hero section, problem section, footer, etc.), upstream deepagents has three problems that combine to make todo progress completely broken:

1. **`afterModel` overwrites completed todos with stale state** — the biggest bug
2. **`EXCLUDED_STATE_KEYS` blocks todos from flowing back** — subagents can't report progress
3. **No mechanism for incremental progress** — all updates arrive at once after all subagents finish

Each of these is explained in detail below.

## Fork Commits

The fork has 4 commits on top of upstream (`4ea1858`):

| Commit | Description |
|--------|-------------|
| `3cd3c26` | Enable todo propagation from subagents to parent |
| `76a7550` | Add enhanced todoListMiddleware with UUID and merge-by-id reducer |
| `26bc0fd` | Emit incremental todo progress via `writer()` during parallel subagent execution |
| `e5dc1a1` | Remove debug logging from `writer()` todo patch emission |

## What Changed (File by File)

### 1. `src/middleware/todos.ts` — New File (replaces upstream `todoListMiddleware`)

**What**: A custom `todoListMiddleware` that replaces the one from the `langchain` package.

**Key differences from upstream:**

| Feature | Upstream (`langchain`) | Our Fork |
|---------|----------------------|----------|
| `afterModel` hook | Yes — rejects parallel `write_todos` calls | **Removed entirely** |
| UUID generation | Yes (added in v1.2.17) | Yes (identical) |
| `ReducedValue` reducer | No — plain `z.object` state schema | **Yes** — `ReducedValue` with merge-by-id + status-priority |
| `pending` → `in_progress` auto-upgrade | No | **Yes** — enforced at framework level |

**Why `afterModel` must be removed:**

This is the critical fix. Upstream's `afterModel` hook creates a **separate LangGraph node** called `todoListMiddleware.after_model`. This node runs after every model turn, including after parallel tool returns from subagents. The problem: it runs with a **stale state snapshot** from before the subagent tools executed.

Here's what happens with upstream's `afterModel` during parallel subagent execution:

```
1. Parent agent dispatches 7 subagents via task tool
2. Subagent 1 finishes → auto-marks "problem" todo as completed
3. Command arrives: todos = [hero:pending, problem:COMPLETED, ...]
4. ✓ Graph reducer processes Command correctly

5. afterModel node fires with its stale snapshot
   → Its state = [hero:pending, problem:PENDING, ...] (pre-tool state)
   → Returns void 0 (no changes needed)
   → BUT: MiddlewareNode.invokeMiddleware spreads ...state on void 0
   → Emits: todos = [hero:pending, problem:PENDING, ...]
   → ✗ OVERWRITES the correct completed state back to pending

6. Subagent 2 finishes → same cycle → overwritten again
```

This was discovered in Experiment 9 of our streaming investigations. The log pattern was unmistakable:

```
[subagents] auto-marked todo problem- as completed
[data-state] node="tools" key="todos" | todosCount: 7         ← correct!
[todosReducer] merge { changes: [], blocked: [] }
[data-state] node="todoListMiddleware.after_model" key="todos" ← OVERWRITES!
```

Every single subagent completion was immediately followed by an `afterModel` merge that reset todos back to all-pending. The reducer showed `blocked: []` because BOTH `current` and `update` came from the same stale snapshot — both all-pending.

The `afterModel` hook's only purpose was rejecting parallel `write_todos` calls (a nice-to-have safety check). This is not worth the correctness cost. Our fork removes `afterModel` entirely.

**Note**: There is also a `pnpm patch langchain@1.2.17` (in the root `package.json`) that fixes a related issue in `MiddlewareNode.invokeMiddleware`: when a middleware hook returned `void 0` (no changes), the code was returning `{ ...state, jumpTo: void 0 }` which re-emitted every state key as an update. The patch changes this to return `{ jumpTo: void 0 }` (empty update). This patch works in conjunction with removing `afterModel` — the patch prevents the `...state` spread, and our fork removes the node that triggered it.

**Why `ReducedValue` with merge-by-id + status-priority:**

When 7 parallel subagents return Commands, each Command contains a full todos array. But each subagent only knows about its own completion — the rest are stale `pending` values from when the subagent started.

Without a smart reducer, the last subagent to return would overwrite all previous completions:

```
Subagent 1 returns: [hero:completed, problem:pending, ...]
Subagent 2 returns: [hero:pending, problem:completed, ...]   ← naive replace would lose hero:completed!
```

The `ReducedValue` with `todosReducer` prevents this. It merges by ID and uses status priority (`completed(2) > in_progress(1) > pending(0)`) — a completed todo can never be downgraded back to pending:

```typescript
function todosReducer(current: Todo[], update: Todo[]): Todo[] {
  const merged = [...current];
  const mergedById = new Map(merged.map((t, i) => [t.id, i]));
  for (const todo of update) {
    const existingIdx = mergedById.get(todo.id);
    if (existingIdx !== undefined) {
      const prev = merged[existingIdx]!;
      const prevPriority = STATUS_PRIORITY[prev.status] ?? 0;
      const nextPriority = STATUS_PRIORITY[todo.status] ?? 0;
      if (nextPriority >= prevPriority) {
        merged[existingIdx] = todo;
      }
      // else: BLOCKED — don't downgrade completed back to pending
    } else {
      mergedById.set(todo.id, merged.length);
      merged.push(todo);
    }
  }
  return merged;
}
```

This reducer runs 7 times sequentially after `Promise.all()` resolves, correctly accumulating all completions even though each subagent had a stale snapshot.

**Why `pending` → `in_progress` auto-upgrade:**

The LLM consistently ignores prompts asking it to set todos to `in_progress`. It writes them all as `pending`. Since the agent IS actively working on them when it calls `write_todos`, we auto-upgrade at the framework level:

```typescript
const todosWithIds = todos.map((t) => ({
  ...t,
  id: t.id || randomUUID(),
  status: t.status === "pending" ? "in_progress" : t.status,
}));
```

The LLM can still explicitly set `completed`. Only `pending` is upgraded.

### 2. `src/middleware/subagents.ts` — Modified (3 changes)

**Change A: Removed `"todos"` from `EXCLUDED_STATE_KEYS`**

```typescript
// BEFORE (upstream):
const EXCLUDED_STATE_KEYS = ["messages", "todos", "structuredResponse", "skillsMetadata", "memoryContents"];

// AFTER (fork):
const EXCLUDED_STATE_KEYS = ["messages", "structuredResponse", "skillsMetadata", "memoryContents"];
```

Upstream excludes `todos` from both the subagent input (via `filterStateForSubagent`) and the subagent output (via `returnCommandWithStateUpdate`). This means:

- Subagents don't see the parent's todo list
- Even if a subagent marks a todo as completed, the update is stripped before returning to the parent

Removing `"todos"` from this list lets todos flow in both directions. The parent's todo list is passed to each subagent, and each subagent's todo updates (including auto-mark completions) flow back in the Command.

The note in our code explains:

```typescript
// Note: todos flows through so subagents can mark their assigned parent todos as completed.
// The parent's todosReducer merges by id, so parallel subagent updates are safe.
```

**Change B: Added `todo_id` parameter to `task` tool schema**

```typescript
schema: z.object({
  description: z.string().describe("The task to execute with the selected agent"),
  subagent_type: z.string().describe(`Name of the agent to use. Available: ${...}`),
  todo_id: z.string().optional().describe(
    "ID of the parent todo item to automatically mark as completed when this task finishes. Pass this to get real-time progress tracking."
  ),
}),
```

This gives the LLM a way to associate each task dispatch with a specific todo item. The LLM passes something like `todo_id: "hero-section"` when dispatching the hero section subagent.

**Change C: Auto-mark logic + `writer()` emission**

After the subagent finishes (`await subagent.invoke()`), the task tool:

1. Finds the todo matching `todo_id` in the result
2. Sets its status to `completed`
3. Emits a `__state_patch__` event via `writer()` for immediate frontend delivery

```typescript
// Auto-mark the assigned parent todo as completed when the subagent finishes
if (todo_id) {
  const todos = (result.todos ?? currentState.todos) as Array<{...}>;
  if (todos) {
    result.todos = todos.map((t) =>
      t.id === todo_id ? { ...t, status: "completed" } : t,
    );

    // Emit immediately via writer() — bypasses Promise.all batching
    if (streamWriter) {
      try {
        streamWriter({
          id: crypto.randomUUID(),
          event: "__state_patch__",
          todos: result.todos,
        });
      } catch {
        // emit failed — falls back to normal state update after Promise.all
      }
    }
  }
}
```

The `writer()` call is critical for real-time progress. Without it, the user stares at 7 spinning todos for ~2 minutes until `Promise.all()` resolves and all updates arrive at once. With `writer()`, each todo flips to completed within seconds of its subagent finishing.

**Important**: `getWriter()` uses `AsyncLocalStorage` to find the writer from the current graph execution context. The subagent's `invoke()` call replaces the ALS context, so `getWriter()` returns `undefined` after invoke. The stream writer **must be captured before invoke**:

```typescript
// BEFORE subagent.invoke() — ALS context is replaced during invocation
let streamWriter: ((data: unknown) => void) | undefined;
try {
  const w = getWriter(config) ?? getWriter();
  if (typeof w === "function") {
    streamWriter = w;
  } else if (w && typeof (w as any).write === "function") {
    streamWriter = (data: unknown) => (w as any).write(data);
  }
} catch {
  // writer not available outside graph streaming context
}

const result = await subagent.invoke(subagentState, config);

// NOW use streamWriter (getWriter() would return undefined here)
```

See [streaming-from-subagents.md](./streaming-from-subagents.md) for the full pipeline explanation.

### 3. `src/agent.ts` — One-Line Change

```typescript
// BEFORE (upstream):
import { todoListMiddleware } from "langchain";

// AFTER (fork):
import { todoListMiddleware } from "./middleware/todos.js";
```

This is what makes the fork actually take effect. `createDeepAgent()` calls `todoListMiddleware()` when assembling the middleware stack. This single import change routes to our implementation instead of the upstream langchain one.

### 4. `src/index.ts` — Added Exports

```typescript
export { todoListMiddleware, type TodoListMiddlewareOptions } from "./middleware/todos.js";
```

Exports our implementation so consumers can use it directly if needed.

## Workspace Resolution

The fork is wired into the monorepo as follows:

- `pnpm-workspace.yaml` has `packages/*/libs/*` glob
- `packages/deepagentsjs/libs/deepagents` resolves as the `deepagents` package
- `langgraph_app/package.json` has `"deepagents": "workspace:*"`
- Root `package.json` has `"deepagents": "workspace:*"` in pnpm overrides
- `langgraph_app/node_modules/deepagents` is a symlink to `../../packages/deepagentsjs/libs/deepagents`

## Related Patches

### `patches/langchain@1.2.17.patch` — REMOVED

We previously maintained a `pnpm patch` against `langchain@1.2.17` that fixed three issues:

1. **`MiddlewareNode.invokeMiddleware` void 0 spread bug** — When a middleware hook returned `void 0`, the code spread `{ ...state }` re-emitting every state key. Fixed upstream in [PR #9986](https://github.com/langchain-ai/langchainjs/pull/9986), shipped in `langchain@1.2.21`.

2. **`initializeMiddlewareStates` null safety** — `ReducedValue` state schemas produced validation issues that crashed the error builder. Fixed upstream in 1.2.21 via proper `StateSchema`/`ReducedValue` handling (extracts `field.inputSchema || field.valueSchema` before parsing).

3. **`todoListMiddleware` UUID generation and reducer** — Added UUID, `id` field, and `ReducedValue` to langchain's built-in `todoListMiddleware`. This was redundant with our fork — both parent agent and subagents import `todoListMiddleware` from our fork, not from langchain.

The patch was removed when upgrading to `langchain@1.2.21`. All three issues are now resolved without patching.

## What Would Need to Happen to Remove the Fork

To upstream our changes and remove the fork, the following would need to happen in the `deepagentsjs` upstream:

1. **Remove `afterModel` from `todoListMiddleware`** — or make it conditional/opt-out. This is the hardest sell because upstream considers the parallel `write_todos` rejection a safety feature.

2. **Make `EXCLUDED_STATE_KEYS` configurable** — or specifically allow `todos` to flow through. This is reasonable since the whole point of subagents is delegated work, and progress tracking is a natural extension.

3. **Add `todo_id` parameter to task tool** — and the auto-mark logic. This is clean and useful for any consumer.

4. **Add `writer()` emission** — the `__state_patch__` pattern for real-time progress. This requires the SDK to also support `data-state-patch-{key}` (which we've implemented in our `langgraph-ai-sdk` fork).

5. **Add `pending` → `in_progress` auto-upgrade** — a small quality-of-life fix.

6. **Add `ReducedValue` with merge-by-id reducer** — or make the state schema configurable.

Until these changes are accepted upstream, the fork is required for correct todo progress tracking in parallel subagent workflows.

## Discovery Timeline

For future reference, here's how these issues were discovered. The full experiment logs are in `plans/website/experiments.md`.

| Experiment | Discovery |
|------------|-----------|
| Exp 5 | Todos always `[]` — LLM never called `write_todos`. Prompt issue in deepagents. |
| Exp 7 | `void 0` spread bug found in `MiddlewareNode`. Patched via `pnpm patch`. Todos stable at 8, no more flicker to empty. |
| Exp 8 | Forked deepagents. Removed `"todos"` from `EXCLUDED_STATE_KEYS`. Added `todo_id` + auto-mark. But todos had no IDs (`no-id:in_progress`) — fork still imported upstream `todoListMiddleware` from langchain. |
| Exp 9 | Moved `todoListMiddleware` entirely into fork. Todos got IDs. Auto-mark fired correctly. BUT: `afterModel` immediately overwrote every completion back to pending. Root cause identified. |
| Exp 10 | Removed `afterModel` from fork. All 7 subagent completions accumulate correctly through the reducer. Status-priority protection confirmed working. But all arrive at once (batched by `Promise.all()`). |
| Exp 11 | Added `writer()` + `__state_patch__` emission. Todos flip one-by-one as each subagent finishes. Real-time progress achieved. |

## File Locations

| File | Purpose |
|------|---------|
| `packages/deepagentsjs/libs/deepagents/src/middleware/todos.ts` | Our `todoListMiddleware` — no afterModel, ReducedValue reducer, auto-upgrade |
| `packages/deepagentsjs/libs/deepagents/src/middleware/subagents.ts` | Modified — todo flow, todo_id, auto-mark, writer() emission |
| `packages/deepagentsjs/libs/deepagents/src/agent.ts` | Import redirect to our todoListMiddleware |
| `packages/deepagentsjs/libs/deepagents/src/index.ts` | Exports our todoListMiddleware |
| `shared/state/website.ts` | Canonical `todosMerge` reducer (used by backend annotation + frontend merge) |
| `langgraph_app/app/annotation/websiteAnnotation.ts` | Outer graph todos reducer (imports from shared) |
