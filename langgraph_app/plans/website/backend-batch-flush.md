# Deferred Batch Flush for Website Files Backend

## Context

The `WebsiteFilesBackend` currently makes one HTTP round-trip to Rails for every `write()` or `edit()` call (~300ms each). For a typical single-shot edit (3-5 edits), this costs 900-1500ms. For a full agent run (8-32 edits across iterations), this costs 2400-9600ms. These writes are sequential and on the critical path — they happen between the LLM response and the next iteration or completion.

The fix: apply edits to the virtual filesystem immediately (preserving edit ordering), but defer all Rails API calls until a single `flush()` at the end. An archived plan at `plans/archive/backend-optimization.md` proposed this same direction but was never implemented.

## Expected Savings

| Scenario              | Current | After  | Savings |
| --------------------- | ------- | ------ | ------- |
| Single-shot (3 edits) | 900ms   | ~300ms | 67%     |
| Single-shot (5 edits) | 1500ms  | ~300ms | 80%     |
| Full agent (24 edits) | 7200ms  | ~300ms | 96%     |

---

## Step 1: Core Backend Changes

**File: `app/services/backends/websiteFilesBackend.ts`**

### 1a. Add dirty-tracking state

- Add `private dirtyPaths: Set<string> = new Set()` field

### 1b. Modify `write()` (line 261)

- Remove Redis lock wrapper (`RedisLock.withLock`)
- Remove `WebsiteFilesAPIService` call (lines 323-327)
- Keep the FS write logic and "file already exists" handling (lines 276-306)
- After successful FS write, add `filePath` to `this.dirtyPaths`

### 1c. Modify `edit()` (line 338)

- Remove Redis lock wrapper
- Remove `WebsiteFilesAPIService` call (lines 392-399)
- Keep FS edit and error logging
- After successful FS edit, add `filePath` to `this.dirtyPaths`

### 1d. Add `flush()` method

- Read final content of each dirty file from virtual FS via `this.fs.readRaw()`
- Skip empty files (matching current behavior at line 318)
- Send one batch call via `service.write({ id, files })` — the write endpoint already accepts arrays
- Clear `dirtyPaths` on success
- Add retry logic (2 retries with backoff) since this is now the single point of persistence

### 1e. Add `hasDirtyFiles()` and `getDirtyPaths()` accessors

### 1f. Fix `grepRaw()` staleness (line 189)

- `grepRaw()` queries the DB directly — after deferred writes, DB is stale for dirty files
- Add hybrid search: for files in `dirtyPaths`, search the local FS; for everything else, use existing DB query
- Merge results (dirty files are typically 3-8, so local search is trivial)

---

## Step 2: Single-Shot Edit Path

**File: `app/nodes/coding/singleShotEdit.ts`**

### 2a. Flush after `applyEdits()` (line 238-253)

- After `applyEdits()` completes with `successCount > 0`, call `await backend.flush()`

### 2b. Flush after retry (line 379)

- Pass `backend` to `retryWithErrorContext()` (add as parameter)
- After retry `applyEdits()` succeeds (`retrySuccessCount > 0`), call `await backend.flush()`

---

## Step 3: Full Agent Path

**File: `app/nodes/coding/agent.ts`**

### 3a. Return backend from full agent builder

- Modify `buildFullCodingAgent()` to return `{ agent, backend }` so caller can flush
- (Currently backend is created inside but not returned)

### 3b. Flush after `agent.invoke()`

- After `agent.invoke()` returns, call `await backend.flush()`
- This covers all iterations — one flush regardless of how many edits occurred

---

## Step 4: Rails Write Endpoint Optimization

**File: `rails_app/app/controllers/api/v1/website_files_controller.rb`**

### 4a. Batch the `find_by` lookups in `write` action (line 73-84)

- Currently: `website.website_files.find_by(path:)` per file (N queries)
- Replace with: `website.website_files.where(path: normalized_paths).index_by(&:path)` (1 query)

**File: `rails_app/app/models/concerns/website_concerns/file_management.rb`**

### 4b. Batch template file lookups in `filter_duplicate_template_files` (line 105)

- Currently: `template_files.find_by(path:)` per file via `duplicate_of_template?` (N queries)
- Preload: `template_files.where(path: all_paths).index_by(&:path)` (1 query)
- Pass preloaded template file to `duplicate_of_template?` to avoid re-querying

---

## Edge Cases Handled

- **Flush failure**: Retry with backoff (2 attempts). If all fail, error propagates to graph error handler. This is strictly better than current behavior (partial DB updates on mid-sequence failure).
- **Process crash before flush**: Same risk as current architecture (crash between edit N and N+1). User re-sends message and agent re-runs.
- **Escalation (single-shot → full agent)**: When `allFailed: true`, no flush happens (FS unchanged since all edits errored). Full agent takes over with clean state, flushes at end.
- **`syncFiles` node**: Runs after websiteBuilder node returns. Flush happens inside the coding agent paths before returning, so DB is up-to-date when syncFiles reads.

---

## Verification

1. **Unit tests**: Update `tests/tests/backends/websiteFilesBackend.test.ts`
   - Verify `write()`/`edit()` update FS but NOT DB
   - Verify `flush()` sends all dirty files in one batch
   - Verify `flush()` is idempotent (second call = no-op)
   - Verify `grepRaw()` returns results from dirty files

2. **Integration tests**: Run `pnpm test` — recordings may need updating since HTTP call patterns change (many individual → one batch)

3. **Manual test**: Start dev servers, make an edit via the frontend, verify files are persisted correctly and the edit completes faster

4. **Timing**: Add `console.time`/`console.timeEnd` around the flush call to measure actual savings vs. baseline
