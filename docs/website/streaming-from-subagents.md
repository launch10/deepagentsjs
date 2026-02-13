# Streaming State from Subagents

When the parent agent dispatches parallel subagents via the `task` tool, LangGraph's `ToolNode` uses `Promise.all()` to execute all tool calls concurrently. State updates (Commands) from each tool are only processed through the graph's reducer **after all tools complete**. This means the frontend sees zero progress for the entire duration of parallel execution, then all updates arrive at once.

This document explains the `__state_patch__` mechanism that bypasses this batching to deliver incremental state updates as each subagent finishes.

## The Problem

```
Parent Agent
    │
    ├─ tool_call: task("hero section",   todo_id="hero")
    ├─ tool_call: task("problem section", todo_id="problem")
    ├─ tool_call: task("footer",          todo_id="footer")
    │
    └─ ToolNode: Promise.all([task1, task2, task3])
                    │
                    │  task2 finishes at 30s ─── but user sees nothing
                    │  task1 finishes at 45s ─── but user sees nothing
                    │  task3 finishes at 90s ─── NOW all 3 Commands process
                    │
                    ▼
              All state updates arrive simultaneously
```

The user stares at 7 spinning todos for ~2 minutes, then they all flip to completed at once.

## The Solution: `writer()` + `__state_patch__`

LangGraph's `writer()` function writes directly to the SSE output stream. It does **not** wait for `Promise.all()`. By emitting state patches via `writer()` inside each tool call, we can push updates to the frontend as each subagent finishes.

```
Parent Agent
    │
    └─ ToolNode: Promise.all([task1, task2, task3])
                    │
                    │  task2 finishes at 30s ──→ writer(__state_patch__) ──→ SSE ──→ frontend
                    │  task1 finishes at 45s ──→ writer(__state_patch__) ──→ SSE ──→ frontend
                    │  task3 finishes at 90s ──→ writer(__state_patch__) ──→ SSE ──→ frontend
                    │
                    ▼
              Graph state also arrives (but frontend already has the right state)
```

## Architecture

The pipeline has 5 layers, each in a different package:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. BACKEND TOOL (deepagentsjs)                                         │
│    subagents.ts — captures writer(), emits __state_patch__ per tool     │
├─────────────────────────────────────────────────────────────────────────┤
│ 2. BACKEND GRAPH REDUCER (langgraph_app)                               │
│    websiteAnnotation.ts — merge-by-id + status-priority on todos       │
│    (processes Commands AFTER Promise.all — provides final consistency)  │
├─────────────────────────────────────────────────────────────────────────┤
│ 3. SDK SERVER (langgraph-ai-sdk)                                       │
│    stream.ts CustomHandler — converts __state_patch__ to               │
│    data-state-patch-{key} SSE chunks                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ 4. SDK CLIENT (langgraph-ai-sdk-react)                                 │
│    StateManager.ts — processes data-state-patch-{key} using            │
│    caller-defined merge reducers against current accumulated state      │
├─────────────────────────────────────────────────────────────────────────┤
│ 5. FRONTEND (rails_app)                                                │
│    shared/state/website.ts — todosMerge reducer (status-priority)      │
│    useWebsiteChat.ts — wires WebsiteMergeReducer into chat options     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Layer-by-Layer

### Layer 1: Backend Tool — Emit via `writer()`

**File**: `packages/deepagentsjs/libs/deepagents/src/middleware/subagents.ts`

The `task` tool captures the graph's stream writer **before** calling `subagent.invoke()`, then emits the updated todos array after auto-marking the todo as completed.

```typescript
import { getWriter } from "@langchain/langgraph";

// BEFORE subagent.invoke() — AsyncLocalStorage context is replaced during invocation
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

// After auto-marking the matched todo as completed:
if (streamWriter) {
  try {
    streamWriter({
      id: crypto.randomUUID(),
      event: "__state_patch__",   // Magic event name — SDK intercepts this
      todos: result.todos,        // Full todos array with this subagent's completion
    });
  } catch {
    // Falls back to normal graph state after Promise.all
  }
}
```

**Critical detail**: `getWriter()` uses `AsyncLocalStorage` to find the writer from the current graph execution context. The subagent's `invoke()` call replaces the ALS context, so `getWriter()` returns `undefined` after invoke. You **must** capture it before.

**Convention**: The event name `__state_patch__` is a reserved convention. The SDK's `CustomHandler` intercepts it. All other keys in the payload (`todos`, `files`, etc.) become individual `data-state-patch-{key}` SSE chunks.

### Layer 2: Backend Graph Reducer — Final Consistency

**File**: `langgraph_app/app/annotation/websiteAnnotation.ts`

The graph's `todos` channel uses a merge-by-id reducer with status-priority protection. This runs **after** `Promise.all()` completes and processes all 7 Commands sequentially. It provides the final consistent state.

```typescript
todos: Annotation<Todo[]>({
  default: () => [],
  reducer: (current, next) => {
    // Merge by ID, never downgrade status
    // completed(2) > in_progress(1) > pending(0)
    const merged = [...current];
    const mergedById = new Map(merged.map((t, i) => [t.id, i]));

    for (const todo of next) {
      const existingIdx = mergedById.get(todo.id);
      if (existingIdx !== undefined) {
        const prev = merged[existingIdx];
        const prevPriority = STATUS_PRIORITY[prev.status] ?? 0;
        const nextPriority = STATUS_PRIORITY[todo.status] ?? 0;
        if (nextPriority >= prevPriority) {
          merged[existingIdx] = todo;
        }
        // else: BLOCKED — don't downgrade completed back to pending
      } else {
        merged.push(todo);
      }
    }
    return merged;
  },
}),
```

**Why status-priority matters**: Each subagent has a stale snapshot. Subagent 3 might return `[hero:pending, problem:pending, solution:completed, ...]` — it doesn't know subagents 1 and 2 already completed hero and problem. Without priority protection, the last subagent's stale `pending` values would overwrite earlier completions.

There is also a matching `todosReducer` inside deepagents' `todoListMiddleware` (`packages/deepagentsjs/libs/deepagents/src/middleware/todos.ts`) that applies the same merge-by-id + status-priority logic to the inner agent's `ReducedValue` channel.

### Layer 3: SDK Server — Convert to `data-state-patch-{key}`

**File**: `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk/src/stream.ts`

The `CustomHandler` intercepts `__state_patch__` events from the `custom` stream mode and re-emits each key as a `data-state-patch-{key}` SSE chunk. This is the bridge between LangGraph's custom events and the SDK's state management protocol.

```typescript
class CustomHandler {
  async handle(chunk: StreamChunk): Promise<void> {
    // ... extract eventName and dataKeys ...

    if (eventName === '__state_patch__') {
      for (const [key, value] of Object.entries(dataKeys)) {
        this.writer.write({
          type: `data-state-patch-${key}`,  // e.g., "data-state-patch-todos"
          id: crypto.randomUUID(),
          data: value,
        });
      }
      return;  // Don't emit as a regular custom event
    }

    // Regular custom events pass through normally
  }
}
```

**No changes needed here when adding new state keys**. The handler converts any key in the `__state_patch__` payload automatically.

### Layer 4: SDK Client — Merge Against Current State

**File**: `packages/langgraph-ai-sdk/packages/langgraph-ai-sdk-react/src/StateManager.ts`

The `StateManager` has four state part types, processed in this order:

| Part type | Merge behavior | Use case |
|-----------|---------------|----------|
| `data-state-final-{key}` | Replace, then lock key | End-of-stream final state |
| `data-state-streaming-{key}` | Merge against **pre-stream snapshot** | Append-style streaming (e.g., growing text) |
| `data-state-patch-{key}` | Merge against **current accumulated state** | Incremental updates from parallel subagents |
| `data-state-{key}` | Merge if reducer exists, else replace | Normal graph state updates |

The key difference between `streaming` and `patch`:

- **`streaming`** merges against the snapshot taken at stream start — good for accumulating data that the LLM is generating token-by-token.
- **`patch`** merges against current state — good for incremental updates from independent workers that each have stale snapshots.

`data-state-{key}` (the regular graph state updates that arrive after `Promise.all`) also uses the merge reducer when one is registered. This prevents the batched graph state from clobbering already-applied patches.

### Layer 5: Frontend — Caller-Defined Merge Reducer

**File**: `shared/state/website.ts`

The merge reducer is defined alongside the state type and registered at the chat options level. It mirrors the backend reducer logic.

```typescript
// shared/state/website.ts
function todosMerge(incoming: Todo[], current: Todo[] | undefined): Todo[] {
  if (!current || current.length === 0) return incoming;

  const merged = [...current];
  const mergedById = new Map(merged.map((t, i) => [t.id, i]));

  for (const todo of incoming) {
    const existingIdx = mergedById.get(todo.id);
    if (existingIdx !== undefined) {
      const prev = merged[existingIdx]!;
      const prevPriority = STATUS_PRIORITY[prev.status] ?? 0;
      const nextPriority = STATUS_PRIORITY[todo.status] ?? 0;
      if (nextPriority >= prevPriority) {
        merged[existingIdx] = todo;
      }
    } else {
      merged.push(todo);
    }
  }
  return merged;
}

export const WebsiteMergeReducer: Merge<WebsiteGraphState> = {
  todos: todosMerge,
};
```

**File**: `rails_app/app/javascript/frontend/hooks/website/useWebsiteChat.ts`

```typescript
import { WebsiteMergeReducer } from "@shared";

return useChatOptions<WebsiteBridgeType>({
  apiPath: "api/website/stream",
  merge: WebsiteMergeReducer,
});
```

The `Merge<TState>` type (from `langgraph-ai-sdk-types`) is:
```typescript
type Merge<TState> = {
  [K in keyof Omit<TState, 'messages'>]?: (incoming: TState[K], current: TState[K] | undefined) => TState[K];
};
```

## Where Reducers Live (Summary)

The merge-by-id + status-priority logic exists in **two places**:

| Location | Package | Purpose |
|----------|---------|---------|
| `todosReducer` in `middleware/todos.ts` | deepagentsjs | Inner agent's `ReducedValue` — accumulates Commands from parallel tools |
| `todosMerge` in `shared/state/website.ts` | shared | **Canonical implementation** — used by both the backend graph reducer (`websiteAnnotation.ts` imports it) and the frontend merge reducer (`WebsiteMergeReducer`) |

The deepagentsjs copy is in a separate git repository (general-purpose agent framework) and can't import app code. The `shared/` copy is the single source of truth for all app code — the outer graph's `Annotation` reducer calls `todosMerge(next, current)` directly.

## Adding Streaming for a New State Key (e.g., `files`)

To add real-time incremental streaming for another state key, follow this checklist:

### 1. Backend: Emit `__state_patch__` with the key

In the tool where the state update happens (e.g., `subagents.ts` after a subagent writes files):

```typescript
if (streamWriter) {
  streamWriter({
    id: crypto.randomUUID(),
    event: "__state_patch__",
    files: result.files,         // Add any key here
    todos: result.todos,         // Can include multiple keys in one event
  });
}
```

**No SDK changes needed** — `CustomHandler` automatically converts every key in a `__state_patch__` event into a `data-state-patch-{key}` chunk.

### 2. Backend: Ensure the graph reducer handles merging

In `websiteAnnotation.ts`, the `files` reducer already uses `{ ...current, ...next }` which merges by filename. If your key needs more sophisticated merging (e.g., never delete, only add), adjust the reducer.

### 3. Frontend: Add a merge reducer

In `shared/state/website.ts`:

```typescript
function filesMerge(
  incoming: Website.FileMap,
  current: Website.FileMap | undefined
): Website.FileMap {
  if (!current) return incoming;
  return { ...current, ...incoming };
}

export const WebsiteMergeReducer: Merge<WebsiteGraphState> = {
  todos: todosMerge,
  files: filesMerge,        // Add here
};
```

That's it. The `WebsiteMergeReducer` is already wired into `useWebsiteChat.ts`. The `StateManager` will automatically use `filesMerge` for both `data-state-patch-files` chunks and regular `data-state-files` chunks.

### 4. Verify convergence

After all subagents complete, `Promise.all()` resolves and the graph's reducer produces the final state. This arrives as `data-state-files` and `data-state-final-files`. Because `data-state-{key}` also uses the merge reducer (and `data-state-final-{key}` replaces unconditionally), the final state always converges — no flicker.

## Gotchas

### Writer capture timing

`getWriter()` uses `AsyncLocalStorage`. When you call `subagent.invoke()`, the subagent's graph execution replaces the ALS context. After invoke returns, `getWriter()` returns `undefined`. **Always capture the writer before invoke.**

### Merge reducer consistency

The frontend merge reducer must be at least as permissive as the backend reducer. If the backend allows a status transition that the frontend blocks, the UI will show stale state until the page refreshes.

### Multiple keys per event

A single `__state_patch__` event can contain multiple keys. Each key becomes a separate `data-state-patch-{key}` chunk. Use this when a tool updates multiple state keys atomically:

```typescript
streamWriter({
  id: crypto.randomUUID(),
  event: "__state_patch__",
  todos: updatedTodos,
  files: updatedFiles,
  status: "in_progress",
});
```

### Fallback behavior

If `writer()` is unavailable (tests, non-streaming context, error), the `__state_patch__` emission silently fails. The frontend still gets the correct final state after `Promise.all()` — it just arrives all at once instead of incrementally. This makes the pattern safe to add anywhere without breaking non-streaming code paths.

### State part precedence

`data-state-final-{key}` always wins. Once a key is finalized, all subsequent `data-state-patch-{key}` and `data-state-{key}` chunks for that key are ignored. This prevents stale patches from overwriting the authoritative final state.

## Existing Precedent

This pattern was inspired by `withNotifications.ts` in the langgraph_app, which already uses `config.writer()` (via graph node config, not tool config) to emit real-time `notify-task-start` and `notify-task-complete` custom events. The key difference is that `__state_patch__` events are intercepted by the SDK and converted to state parts, while notification events pass through as regular custom events.

## Test Coverage

| Test file | What it covers |
|-----------|---------------|
| `langgraph-ai-sdk-react/.../langgraphChat.test.ts` | 6 tests: `data-state-patch-` merge semantics, status-priority, stale replacement protection |
| `langgraph-ai-sdk/.../stream.test.ts` | 2 tests: `__state_patch__` to `data-state-patch-{key}` conversion |
| `langgraph-ai-sdk/.../subagent-filtering.test.ts` | Subagent chunk filtering (prerequisite — without this, subagent state leaks) |
| `langgraph-ai-sdk/.../todos-flicker.test.ts` | Validates the langchain patch that prevents `void 0` returns from re-emitting state |
