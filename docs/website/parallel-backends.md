# Parallel Subagent Backend Isolation

## Problem: Shared Backend Instance Causes File Corruption

When the website coding agent receives a complex edit request (e.g., "rewrite all the copy to be more casual"), the system spawns **parallel subagents** — one per component file (Hero.tsx, Problem.tsx, Solution.tsx, etc.). All subagents run concurrently for speed.

**The critical design constraint:** All parallel subagents share the **same `WebsiteFilesBackend` instance** — including the same `dirtyPaths` Set and the same virtual filesystem directory on disk.

### Architecture

```
websiteBuilder node
  └── spawns 6 parallel "coder" subagents
       ├── Hero subagent      ──┐
       ├── Problem subagent    │
       ├── Solution subagent   ├── ALL share same WebsiteFilesBackend instance
       ├── SocialProof subagent│     (same dirtyPaths Set, same FS directory)
       ├── CTA subagent        │
       └── Footer subagent    ──┘
```

This shared backend is established in `agent.ts:189`:
```typescript
backend: () => backend  // factory returns SAME instance
```

And consumed in `fs.ts:232-240`:
```typescript
getBackend()  // calls factory, gets same instance
```

### The Corruption Sequence (Pre-Fix)

Before the fix, `flush()` operated on ALL dirty paths and then cleared ALL of them:

1. **Footer subagent finishes first** (~15:40:49), calls `singleShotEdit → flush()`
2. `flush()` iterates `this.dirtyPaths` — which contains ALL dirty files from ALL subagents
3. It reads `Solution.tsx` from disk — but Solution has only had edit 1 of 5 applied (partial content)
4. `flush()` sends this **partial content** to Rails → **DB has corrupted Solution.tsx**
5. `flush()` calls `this.dirtyPaths.clear()` — clears ALL paths, even those still being edited
6. Later subagents continue editing, re-dirty their files, and flush correct content
7. Final state MAY be correct (if all later flushes succeed), but there's a **corruption window**

### Why the Symptoms Appear

- **Extra closing braces**: Partial file content = missing the end of edits = original closing braces still present
- **Duplicated JSX fragments**: `fs.readFile` during another subagent's `fs.writeFile` can read truncated/partial content (OS-level race between libuv thread pool operations)
- **Intermittent**: Only happens when subagents finish at different times (which is always, since files have different complexity)

### Evidence Chain

| Evidence | Location |
|----------|----------|
| Factory returns same instance | `agent.ts:189` — `backend: () => backend` |
| getBackend calls factory | `fs.ts:232-240` |
| dirtyPaths is shared | `WebsiteFilesBackend` instance property |
| Old flush() cleared everything | `flush()` called `this.dirtyPaths.clear()` |
| LangSmith trace `ac89612c` | 6 parallel tasks, all started at 15:40:38, finished at different times |

---

## Fix: Scoped Flush

The fix has two parts: **scope-aware flush** in the backend, and **per-invocation tracking** in singleShotEdit.

### 1. Backend: `flush(pathsToFlush?)` — Scope-Aware

**File:** `langgraph_app/app/services/backends/websiteFilesBackend.ts`

`flush()` now accepts an optional list of paths. When provided:
- Only those paths are read from the virtual FS and sent to Rails
- Only those paths are removed from `dirtyPaths`
- Other subagents' dirty paths are untouched

```typescript
async flush(pathsToFlush?: string[], maxRetries: number = 2): Promise<void> {
  const targetPaths = pathsToFlush ?? [...this.dirtyPaths];
  // ... only reads and sends targetPaths ...
  // Only clear the paths we actually flushed
  for (const p of targetPaths) {
    this.dirtyPaths.delete(p);
  }
}
```

When called without arguments (legacy behavior), it still flushes everything — this is used by the full agent path in `agent.ts` which runs sequentially.

### 2. singleShotEdit: Per-Invocation Dirty Path Tracking

**File:** `langgraph_app/app/nodes/coding/singleShotEdit.ts`

Each `singleShotEdit` invocation:

1. **Snapshots** the current dirty paths before applying edits
2. **Applies edits** (which add to dirtyPaths on the shared backend)
3. **Computes** which paths THIS invocation dirtied (set difference)
4. **Collects** file content for progressive streaming (BEFORE flush)
5. **Flushes** ONLY its own paths

```typescript
// Snapshot BEFORE edits
const preEditDirtyPaths = new Set(backend.getDirtyPaths());

// ... apply edits ...

// Compute THIS invocation's dirty paths
const myDirtyPaths = backend.getDirtyPaths().filter(p => !preEditDirtyPaths.has(p));

// Collect files BEFORE flush (flush removes from dirtyPaths)
files = await collectDirtyFiles(backend, myDirtyPaths);

// Flush ONLY this invocation's files
await backend.flush(myDirtyPaths);
```

The same pattern is applied in the retry path (`retryWithErrorContext`).

---

## Additional Fixes

### Path Normalization

Tool-facing paths have a leading slash (`/src/Hero.tsx`), but Rails stores paths without one (`src/Hero.tsx`). Before the fix, `filesUpdate` keys used the raw tool path, causing duplicate entries in frontend state.

Both `write()` and `edit()` now use `normalizePathForState()` to strip the leading slash from `filesUpdate` keys:

```typescript
private normalizePathForState(filePath: string): string {
  return filePath.replace(/^\//, "");
}
```

`collectDirtyFiles()` also normalizes keys.

### Write Read-Back

`write()` for existing files (the "already exists" → edit path) now reads back from the virtual FS after the edit, rather than optimistically returning the desired content. This matches `edit()`'s existing pattern and prevents mismatches when the underlying edit applies differently than expected.

### collectDirtyFiles Ordering

Previously, `collectDirtyFiles()` was called AFTER `flush()`, which meant `dirtyPaths` was already cleared — it always returned `undefined`. Now it's called BEFORE flush, with scoped paths, so single-shot edits get progressive streaming.

---

## Instrumentation

`FLUSH_START` now logs:
- `totalDirtyPaths` — how many paths are dirty across ALL subagents
- `flushedPathCount` — how many paths THIS flush is targeting
- `contentTails` — last 200 chars of each file being flushed (for corruption detection)

`FLUSH_COMPLETE` logs:
- `flushedPaths` — which paths were sent to Rails
- `remainingDirtyPaths` — which paths are still dirty (other subagents' files)

When `flushedPathCount < totalDirtyPaths` during parallel subagent runs, that confirms each subagent is correctly scoping its flush.

Log location: `/tmp/website_files_backend.log`

---

## Verification Checklist

1. **TypeScript compiles** — `pnpm run typecheck` passes (no new errors)
2. **Unit tests** — `pnpm test -- --testPathPattern=websiteFilesBackend`
3. **Manual test (parallel subagents)**:
   - Create a website, then send "rewrite all the copy to be more casual"
   - After completion, check DB content for each file — no partial content, extra braces, or duplicated fragments
   - Check `/tmp/website_files_backend.log` — verify each flush only contains paths from its own invocation
4. **Scoped flush verification**: Logs show `flushedPathCount < totalDirtyPaths` during parallel runs
5. **Path normalization**: No duplicate keys in frontend state (`/src/Hero.tsx` vs `src/Hero.tsx`)

---

## Key Takeaways

1. **Shared mutable state + parallel execution = corruption**. The `dirtyPaths` Set and virtual FS are shared across all subagents. Any operation that reads or clears shared state must be scoped to the caller's files.

2. **`flush()` was the critical section**, not the edits themselves. Individual `edit()` and `write()` calls on the virtual FS are atomic enough (single file). The problem was `flush()` reading ALL dirty files (including half-edited ones from other subagents) and then clearing everything.

3. **Order matters: collect before flush**. If you need data from dirty paths (for streaming/state updates), you must read it BEFORE calling flush, because flush removes paths from the dirty set.

4. **Path normalization must be consistent across the pipeline**: tool paths (with `/`), DB paths (without `/`), and state keys (should match DB) must all agree, or the frontend gets duplicate entries.
