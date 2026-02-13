# Website Streaming Experiments

## Current Understanding (updated after Experiment 14)

### What works
- **SSE pipeline is fully functional.** 2,672 chunks over 155s. First chunk at 24ms (no buffering).
- **Subagent interleaving FIXED (messages).** `isSubagentNamespace()` in the SDK correctly filters subagent chunks from `RawMessageHandler` and `OtherToolHandler` using `checkpoint_ns`. 4,128 chunks filtered, 2,504 passed. No subagent text leaks to the user.
- **Todos populate during execution.** The LLM now calls `write_todos` with IDs (7 todos created, e.g. `hero-section`, `problem-section`). `todoOverrideMiddleware` is working.
- **Files arrive during execution.** `data-state-files` chunks arrive as an Object (not array) mid-stream. **Now progressive (Exp 13):** `WebsiteFilesBackend` returns `filesUpdate` → files enter agent state via `Command` → flow through `returnCommandWithStateUpdate()` → `data-state-files` SSE. Frontend `filesMerge` reducer normalizes `string[]` → `string`. **Single-shot path also returns files (Exp 14):** `singleShotEdit` collects dirty files from backend → returns in graph state → `improveCopyNode` passes through.
- **State streaming works.** `data-state-*` chunks (chatId, status, todos, files) flow through correctly.
- **Todos flicker ROOT CAUSE FOUND AND PATCHED.** See Experiment 7. `MiddlewareNode.invokeMiddleware` in langchain was spreading `...state` when hooks returned `void 0`. Fixed via `pnpm patch langchain@1.2.17`.
- **Deepagents forked** into `packages/deepagentsjs` (git submodule from `git@github.com:launch10/deepagentsjs.git`). We own `todoListMiddleware`, `subagents.ts`, and all middleware.
- **Auto-mark fires correctly.** The `todo_id` parameter on the `task` tool works — LLM passes todo IDs, and `returnCommandWithStateUpdate` marks the matched todo as `completed`. See Experiment 9.
- **Todos flow through subagents.** `"todos"` removed from `EXCLUDED_STATE_KEYS` in deepagents fork. Subagent returns include todos in their Command updates.
- **Conversation compaction is correct and conservative.** See Experiment 12. Counts human turns (not raw messages), keeps 20 recent turns, threshold at 30. Summary uses neutral third-person voice. Stored as AIMessage with `name="context"` — correctly excluded from `lastAIMessage()` and filtered from UI.

### What's broken

| # | Problem | Root Cause | Severity |
|---|---------|-----------|----------|
| 1 | **~~Text arrives as wall, not streamed~~** | First `data-content-block-text` at chunk #2500 @148s. Parent agent's greeting + summary arrives as one dump at the end, not token-by-token during execution. | ~~High~~ → **Partially addressed (Exp 13)** — single-shot edits now stream text first via tell-then-do prompt |
| 2 | **~~Todos flicker to empty~~** | **FIXED in langchain core.** Root cause: `MiddlewareNode.invokeMiddleware` in langchain spreads `...state` when a middleware hook returns `void 0`. Originally patched via `pnpm patch langchain@1.2.17` — **now fixed upstream. TODO: update langchain dependency and remove local patch.** | ~~High~~ → **FIXED (upstream)** |
| 3 | **Text squished together** | Parent agent's response has no newlines between sections. All text from different response parts concatenated without spacing. | Medium — ugly but readable |
| 4 | **History reload shows perpetual spinner** | After page refresh, "Getting ready..." spinner never resolves. Page preview loads but sidebar stays in loading state. **Compaction was part of the cause** — old threshold (12 messages) aggressively summarized, losing agent messages on reload. Now threshold=30 human turns, keepRecent=20. Spinner may still need a separate frontend fix. | High — partially addressed (Exp 12), verify |
| 5 | **~~Todos lost on reload~~** | Likely fixed — end-of-stream wipe was caused by same root as #2. Needs verification. | ~~Medium~~ → **Verify** |
| 6 | **MAYBE INIT fires repeatedly** | `useWebsiteInit` useEffect fires 13+ times before stream starts (BuildStep.tsx:46). Not harmful but wasteful. | Low — cosmetic log spam |
| A | **~~Subagent state leaks to parent stream~~** | Originally thought `BaseStateHandler` needed `isSubagentNamespace()` filtering like `RawMessageHandler`. **Actually BY DESIGN:** state updates (files, todos) from subagents MUST propagate — this is how progressive file streaming works. The original bug (empty todo list from subagent) was caused by `afterModel` hook (fixed in Exp 10, confirmed upstream). Existing test `subagent-filtering.test.ts:215` explicitly verifies "state updates propagate regardless of namespace." | ~~High~~ → **NOT A BUG** |
| B | **Preview fails: export mismatches** | LLM generates components with `export default` but IndexPage uses named imports `{ Component }`. Code generation quality issue. **Plan:** Surface WebContainer console errors to user via existing log event system → either prompt "fix it?" or auto-submit to backend. | High — broken preview |
| C | **tailwind.config.ts syntax error** | `import type { Config }` in a `.ts` file required via CJS. Same fix path as B — surface errors, let agent fix. | Medium — contributes to broken preview |
| D | **~~afterModel overwrites subagent todo completions~~** | **FIXED (Exp 10) — also fixed upstream in langchain core.** `todoListMiddleware.after_model` creates a separate LangGraph node that runs with a stale state snapshot (from before subagent tools executed). Even returning `undefined`, its state schema triggers the reducer with stale all-pending todos, overwriting completed states. Removed `afterModel` from our forked `todoListMiddleware`. | ~~High~~ → **FIXED (upstream)** |
| E | **~~Parallel subagent Commands may not accumulate~~** | **FIXED (Exp 10).** Commands DO go through the ReducedValue reducer. 7 sequential merges accumulate all completions correctly. Status-priority protection blocks all downgrades. However, all 7 arrive at once after `Promise.all()` — no incremental progress during execution. | ~~Medium~~ → **FIXED** |
| F | **~~No incremental todo progress during execution~~** | **FIXED (Exp 11).** `writer()` captured pre-invoke in `subagents.ts` emits `__state_patch__` custom events per-subagent. SDK converts these to `data-state-patch-{key}` SSE chunks. `StateManager` merges via registered reducer. `todosMerge` (status-priority) on frontend prevents stale replacements. Todos flip one-by-one as each subagent finishes. | ~~High~~ → **FIXED** |
| G | **Flaky spinner during improve copy** | **ROOT CAUSE CONFIRMED (Exp 15).** `improve_copy` uses `updateState()` → `runStateOnly()`. Assistant message only created when `data-content-block-text` chunks arrive. LLM non-determinism: sometimes text before tool_use (spinner works), sometimes tool_use first (no assistant message → spinner fails). **Fix: switch to `sendMessage()` instead of `updateState()`** — creates assistant message immediately, also shows user's request in chat. | Medium |
| H | **Stale todos from create flow persist during improve copy** | Improve-copy graph doesn't clear/reset todos. Frontend renders whatever is in state. **(Exp 15 — not reproduced, CreateFlowTodoList not rendered during improve copy)** | Low |
| I | **Page flicker (white flash) during file streaming** | **CONFIRMED (Exp 15).** Every file change sets `status = "mounting"`, which unmounts the iframe (`isReady = status === "ready"` → false). Each update causes iframe DOM removal → white flash → remount. Mount itself is fast (15ms) but iframe removal/re-add causes flash. **Fix: skip `status = "mounting"` for incremental updates when iframe is already loaded.** | High |
| J | **HMR cascade: ~50+ page reloads per file mount** | **FOUND (Exp 15).** `mount()` writes ALL 72 files at once. Vite sees every file as changed and triggers individual HMR/reload for each. Should diff files and only mount changed ones. | High — wastes time, causes multiple page reloads |
| K | **`vite.config.ts` remounted triggers full Vite restart** | **FOUND (Exp 15).** Config file is re-mounted every time even if unchanged. Vite detects config change → full server restart (18.5s on first load). Must exclude config files from incremental mounts, or diff to skip unchanged files. | High — 18s restart per file update |
| L | **`loadProject` fires twice per file update** | **FOUND (Exp 15).** loadProject called #3/#4, #5/#6 in pairs. Likely React StrictMode double-effect or rapid successive file state updates causing duplicate mounts. | Medium — wasteful |

### Architecture facts confirmed
- `runStateOnly` is the code path for initial website generation (not `sendMessage`)
- `isSubagentNamespace()` checks `checkpoint_ns` for `tools:` segments — this is the correct filter
- Parent agent chunks have namespace like `run:...|default:...|websiteBuilder:...|model_request:...` (no `tools:`)
- Subagent chunks have `tools:XXXX` in namespace — correctly filtered
- LangGraph `updates` stream mode only includes keys a node explicitly returned (confirmed via SDK tests)
- `MiddlewareNode.invokeMiddleware` was spreading `...state` on `void 0` returns, causing phantom state re-emissions — **patched locally, now fixed upstream in langchain core. Local patch can be removed.**
- **`afterModel` hooks in middleware create SEPARATE LangGraph nodes** (e.g. `todoListMiddleware.after_model`). These nodes run with their own state snapshot, which can be stale relative to concurrent tool returns. This is the root cause of the "back and forth pending/completed" bug. **Removing `afterModel` from `todoListMiddleware` is the fix.**
- **Command updates from tools DO go through ReducedValue reducers.** Confirmed in Experiment 10: 7 sequential `[deepagents:todosReducer] merge` calls process each subagent's Command. The missing reducer logs in Experiment 9 were because `afterModel` ran immediately after and overwrote the state. With `afterModel` removed, the reducer correctly accumulates all completions.
- **Parallel tool Commands are batched by `Promise.all()`.** All subagent tools run in parallel, but their Command returns are processed sequentially through the reducer only AFTER all tools complete. No incremental progress during execution — all completions arrive at once.
- **Subagent has its own `todoListMiddleware`** with its own `todos` channel starting at `[]`. This is NOT the subagent saying "I finished a parent todo" — it's internal bookkeeping noise. `EXCLUDED_STATE_KEYS` prevents this at the LangGraph state level (for all keys except `todos` now).
- **`BaseStateHandler.handle()` intentionally does NOT filter subagent state.** State updates (files, todos) from subagent namespaces MUST propagate — this is the mechanism for progressive file/todo streaming. The original empty-todo issue was `afterModel` (fixed Exp 10), not BaseStateHandler. Confirmed by test `subagent-filtering.test.ts:215`.
- **deepagents workspace resolution**: `pnpm-workspace.yaml` has `packages/*/libs/*` glob. `packages/deepagentsjs/libs/deepagents` resolves as the `deepagents` package. `langgraph_app/node_modules/deepagents` symlinks to `../../packages/deepagentsjs/libs/deepagents`.
- **`@langchain/anthropic` rejects SystemMessages not at position 0.** Error: `"System messages are only permitted as the first passed message."` This means conversation summaries CANNOT use SystemMessage — they'd be mid-conversation. AIMessage with `name="context"` is the correct approach.
- **`lastAIMessage()` now excludes context messages.** Symmetric with `lastHumanMessage()`. Both filter out messages where `name === "context"`. This prevents conversation summaries (AIMessage) from being treated as the agent's last response.
- **Compaction counts human turns, not raw messages.** Tool calls (AIMessage+ToolMessage groups) are atomic but don't inflate the turn count. A 20-turn conversation with heavy tool use might have 200+ raw messages but still counts as 20 turns. With Anthropic prompt caching (cached tokens = 10% base cost), keeping more context is cost-effective.

### Next steps (prioritized)

1. ~~**Update langchain + remove local patch**~~ — **DONE.** Upgraded to `langchain@1.2.21`, removed `patches/langchain@1.2.17.patch`, removed `patchedDependencies` from root `package.json`. Void 0 spread fix ([PR #9986](https://github.com/langchain-ai/langchainjs/pull/9986)) and `ReducedValue` state schema handling are now upstream.
2. **Verify `in_progress` auto-upgrade** — Restart the server after the latest build and confirm `write_todos` logs show `in_progress` instead of `pending`. The code is in place but wasn't picked up in the Exp 10 test run.
3. ~~**Fix subagent state leak in `BaseStateHandler`**~~ — **NOT A BUG.** State updates from subagents MUST propagate (files, todos). The original empty-todo issue was `afterModel` (fixed Exp 10). Existing test explicitly verifies state propagation across namespaces.
4. **Surface WebContainer errors to user (B/C)** — WebContainerManager already emits `{ type: "log", message }` events. Vite errors like "No matching export" flow through there.
5. **Verify history reload after compaction fix (Exp 12)** — Test a long conversation (>30 human turns), let it compact, then reload. Confirm: (a) last 20 turns of context preserved, (b) summary appears in neutral third-person, (c) agent responds naturally without treating summary as instructions, (d) spinner resolves on reload.
6. ~~**Investigate incremental progress during execution**~~ — **DONE (Exp 13).** `WebsiteFilesBackend` now returns `filesUpdate` from `write()` and `edit()`. Files enter agent state via `Command({ update: { files } })` and flow through `returnCommandWithStateUpdate()` to the parent. Frontend `filesMerge` reducer normalizes `string[]` → `string`.
7. **Verify progressive file streaming end-to-end (Exp 13+14)** — Start dev servers, test create + edit flows. Confirm `data-state-files` SSE events fire during agent execution and preview renders before summary completes.
8. ~~**Single-shot edits return files for progressive streaming**~~ — **DONE (Exp 14).** `singleShotEdit` now collects dirty files from backend via `getDirtyPaths()` + `readRaw()` after edits. Returns `files: Website.FileMap` in result. `createCodingAgent` passes through to graph state. `improveCopyNode` now returns files alongside messages.

---

## Experiment 13: Progressive file streaming + single-shot tell-then-do

**Status**: Complete (code changes done, needs end-to-end verification)
**Date**: 2026-02-11

### Problems being solved
1. **Files don't render until after agent's summary** — `WebsiteFilesBackend.write()` and `edit()` returned `filesUpdate: null`, so files never entered the agent's state. They only reached the frontend after `backend.flush()` → DB write → `websiteBuilder` node read from DB → final state.
2. **Single-shot edits produce no visible output until completion** — LLM generated tool_use blocks with no text → fallback "I've made the requested changes." fired every time.
3. **Hardcoded fallback text** — The prompt told the LLM to confirm AFTER editing (step 4). Since Claude generates tool_use blocks before text in that ordering, the text was always empty.

### Root cause analysis
- `filesUpdate: null` in `write()` and `edit()` meant deepagents' `fs.ts` middleware returned a plain `ToolMessage` instead of `Command({ update: { files } })`. Files never entered the agent's inner state, so they never flowed through `returnCommandWithStateUpdate()` to the parent graph.
- The frontend `StateManager` already processes `data-state-files` and `data-state-final-files` events via merge reducers. The only missing piece was getting files INTO the state.
- **`__state_patch__` is NOT needed.** Files flow through the normal `returnCommandWithStateUpdate()` → parent graph state → `BaseStateHandler` → `data-state-files` SSE events. The `__state_patch__` mechanism (used for todos) is specifically for bypassing `Promise.all()` batching for immediate emission. Since files arrive via the normal Command path, this is sufficient.

### Changes made

**1. `WebsiteFilesBackend` returns `filesUpdate`** (`langgraph_app/app/services/backends/websiteFilesBackend.ts`)
- `write()`: Returns `filesUpdate: { [filePath]: { content: content.split("\n"), created_at, modified_at } }`
- `edit()`: Reads updated content via `this.fs.readRaw()`, returns same format
- This triggers `fs.ts` middleware to create `Command({ update: { files: result.filesUpdate } })` — files now enter the agent's state

**2. Frontend `filesMerge` reducer** (`shared/state/website.ts`)
- New `filesMerge()` function normalizes `string[]` content to `string` (joining with `\n`)
- Critical because deepagents `FileData.content` is `string[]` (array of lines) but frontend expects `content: string`
- `file-utils.ts:28` checks `typeof fileData.content !== "string"` and **skips** non-strings — without normalization, incremental file patches would be invisible to the preview
- Added to `WebsiteMergeReducer` so `StateManager` applies it to all `data-state-*-files` events

**3. Single-shot "tell, then do" prompt** (`langgraph_app/app/nodes/coding/singleShotEdit.ts`)
- Workflow step 1 changed from "read files" to "Start with a brief message describing what you'll change"
- Claude generates text before `tool_use` blocks when instructed — text streams via `["notify"]` tag immediately
- Fallback text changed from `"I've made the requested changes."` → `"Done! Your changes have been applied."` (both locations)
- Fallback is now rare since the prompt instructs text-first

### RED/GREEN/REFACTOR

**RED phase:**
- Unskipped 4 existing tests in `websiteFilesBackend.test.ts` (were `describe.skip("filesUpdate for state sync")` — blocked on deepagents PR #111 which is now moot since we forked)
- Added 1 new test in `singleShotEdit.unit.test.ts`: `"uses improved fallback text when LLM provides no text content"` — asserts fallback is `"Done! Your changes have been applied."` not old text
- All 5 tests confirmed RED (failing with current code)

**GREEN phase:**
- Implemented backend `filesUpdate` returns → 4 backend tests pass
- Updated fallback text → 1 singleShotEdit test passes
- All 52 tests pass across both files (40 backend + 12 singleShotEdit)

**Verification:**
- TypeScript typecheck passes (0 new errors; 8 pre-existing in `recommendDomains.ts`)
- `agent.unit.test.ts` has 5 pre-existing failures (confirmed by running before/after stash)

### Data flow after fix
```
Agent write()/edit() → filesUpdate returned → Command updates inner state
  → subagent completes → returnCommandWithStateUpdate() includes files
  → parent graph state update → BaseStateHandler emits data-state-files SSE
  → Frontend StateManager.processStatePart() → filesMerge reducer normalizes string[] → string
  → WebContainer remounts → preview updates
```

### What was NOT changed (and why)
- **`subagents.ts`** — No `__state_patch__` emission for files. Normal Command flow through `returnCommandWithStateUpdate()` is sufficient. `__state_patch__` is only needed for bypassing `Promise.all()` batching (used for todos).
- **`websiteBuilder.ts`** — Still reads from DB and returns `Website.FileMap` as belt-and-suspenders final state
- **`stream.ts` CustomHandler** — Already converts `__state_patch__` → `data-state-patch-*` for any key
- **`StateManager.ts`** — Already processes `data-state-patch-*` via merge reducers
- **`fs.ts` middleware** — Already creates `Command({ update: { files } })` when `filesUpdate` is non-null

### Files modified
1. `langgraph_app/app/services/backends/websiteFilesBackend.ts` — `write()` and `edit()` return `filesUpdate`
2. `shared/state/website.ts` — `filesMerge` reducer with `string[]` → `string` normalization
3. `langgraph_app/app/nodes/coding/singleShotEdit.ts` — tell-then-do prompt, improved fallback
4. `langgraph_app/tests/tests/backends/websiteFilesBackend.test.ts` — unskipped 4 tests
5. `langgraph_app/tests/tests/nodes/coding/singleShotEdit.unit.test.ts` — 1 new fallback test

### End-to-end verification needed
1. **Create flow**: Create a new landing page → preview should start rendering BEFORE summary finishes
2. **Single-shot edit**: "Change the headline" → agent describes change first, text streams immediately
3. **Full agent edit**: "Redesign the hero section" → todos + preview update before summary
4. **Logs**: Confirm `data-state-files` events fire during agent execution

---

## Experiment 15: "Improve Copy" intent end-to-end test

**Status**: In progress (diagnostics added, needs verification)
**Date**: 2026-02-11

### Problems found (3 original + 3 new from diagnostics)

| # | Problem | Root Cause | Status |
|---|---------|-----------|--------|
| G | **Flaky spinner during improve copy** | `runStateOnly()` only creates assistant message when text chunks arrive. LLM non-determinism: text-before-tools = spinner works, tools-before-text = no spinner. | **Root cause confirmed** |
| H | **Stale todos from create flow** | Not reproduced — `CreateFlowTodoList` not rendered during improve copy flow. | **Not applicable** |
| I | **Page flicker (white flash)** | Every file change sets `status = "mounting"` → iframe unmounts → remounts. Mount is 15ms but iframe DOM removal causes flash. | **Confirmed** |
| J | **HMR cascade: ~50+ page reloads per mount** | `mount()` writes ALL 72 files. Vite sees each as changed → individual HMR/reload per file. | **NEW — found via diagnostics** |
| K | **`vite.config.ts` triggers full Vite restart** | Config file remounted even if unchanged → Vite detects config change → full server restart (18.5s). | **NEW — found via diagnostics** |
| L | **`loadProject` fires twice per update** | Called in pairs (#3/#4, #5/#6). React StrictMode or rapid state updates. | **NEW — found via diagnostics** |

### Root cause analysis: Flaky spinner (G)

**Code path:** `improve_copy` intent → `improveCopySubgraph` → `createCodingAgent({ route: "single-shot" })` (deterministic, confirmed in `createIntentGraph.ts:55-57`).

`isStreaming` is `status === 'streaming' || status === 'submitted'` (`chatSelectors.ts:55-57`) — true in both cases. But `StreamingIndicator` also requires `lastMessage.role === "assistant" && !hasTextContent`.

With `runStateOnly()`, assistant message only created when `data-content-block-text` arrives (`langgraphChat.ts:608-614`). "Tell-then-do" prompt (Exp 13) makes text-first *more likely* but not guaranteed.

**Planned fix:** Switch improve copy from `updateState()` to `sendMessage()`. This creates a user message + assistant message upfront, so spinner always works. Also looks cleaner — user sees their request in chat.

### Root cause analysis: HMR cascade + Vite restart (J, K)

From logs — on incremental file update during improve copy:
```
loadProject called (#5) — isIncremental: true
Mounting project files...
Project files mounted in 9ms
```
Then immediately:
```
4:42:48 PM [vite] vite.config.ts changed, restarting server...  ← 18.5s restart!
4:42:48 PM [vite] page reload index.html
4:42:48 PM [vite] page reload tailwind.config.ts
4:42:48 PM [vite] hmr update /src/components/Hero.tsx, ...
... (~50 more HMR/reload events)
```

**Root cause:** `mount()` writes ALL files every time, including config files that haven't changed. Vite detects `vite.config.ts` change → full server restart. All other files trigger individual HMR events.

**Fix:** Diff files before mounting. Only write files whose content actually changed. Never remount `vite.config.ts`, `tailwind.config.ts`, `package.json` unless they actually differ.

### Diagnostics added

Six files instrumented with `import.meta.env.DEV` guarded console logs:

1. **`StreamingIndicator.tsx`** — `isStreaming`, `lastMessageRole`, `hasTextContent`, `showIndicator`
2. **`CreateFlowTodoList.tsx`** — Todo count, IDs, statuses, `isStreaming`
3. **`useWebsitePreview.ts`** — File changes, status transitions, mount cycle timing
4. **`WebsitePreview.tsx`** — Iframe mount/unmount, `preview-ready` postMessage, `showLoading`
5. **`manager.ts` (`loadProject`)** — Call count, `isIncremental`, mount timing, missing deps
6. **`manager.ts` (Vite output)** — `[WebContainer:HMR]` tags for hmr update and page reload

### Confirmed from diagnostic run

1. **loadProject fires 6 times** total (2 on initial load, 2 on Vite restart recovery, 2 on improve copy)
2. **Iframe DOES unmount** — `{isReady: false, iframeLoaded: true, showLoading: true, status: 'mounting'}` logged
3. **Mount cycle is fast** — 12-15ms for file mounting itself
4. **Vite restart is slow** — 18.5s (first load), 35.4s (second config change detection)
5. **`tailwind.config.ts` CJS error persists** — `import type { Config }` syntax error on every restart

---

## Experiment 14: Single-shot edits return files for progressive streaming

**Status**: Complete (code changes done, needs end-to-end verification)
**Date**: 2026-02-11

### Problem being solved
Single-shot edits (improve copy, quick edits via Haiku) don't return files to graph state. `executeTextEditorCommand()` returns `Promise<string>`, discarding the `filesUpdate` from `backend.edit()`. Files only reach the frontend when `syncFiles` reads from DB at graph end.

With Exp 13, the full agent path gets progressive file streaming (deepagents middleware → Command → state). But single-shot bypasses deepagents entirely — it calls `executeTextEditorCommand()` directly. The fix collects edited files from the backend's dirty tracking.

### Root cause
- `executeTextEditorCommand()` (`textEditorTool.ts`) calls `backend.edit()` which now returns `filesUpdate` (Exp 13)
- But `handleStrReplace()` returns only the success string, discarding `filesUpdate`
- `applyEdits()` in `singleShotEdit.ts` collects only strings
- Result: `singleShotEdit` returns `{ messages, status }` with no files
- Graph flow: `improveCopy → cleanupFilesystem → syncFiles` — files arrive only at `syncFiles`

### Changes made

**1. `collectDirtyFiles()` helper** (`langgraph_app/app/nodes/coding/singleShotEdit.ts`)
- After edits are applied, reads all dirty files from backend via `getDirtyPaths()` + `readRaw()`
- Normalizes `string[]` → `string` content (same as `filesMerge` reducer)
- Returns `Website.FileMap` or `undefined` if no files modified

**2. `singleShotEdit` returns files** (`langgraph_app/app/nodes/coding/singleShotEdit.ts`)
- Return type extended: `files?: Website.FileMap`
- Both primary path and retry path call `collectDirtyFiles(backend)` and include in result
- Retry path fallback text also updated: `"I've made the requested changes."` → `"Done! Your changes have been applied."`

**3. `createCodingAgent` passes through files** (`langgraph_app/app/nodes/coding/agent.ts`)
- Return type extended with `files?: Website.FileMap`
- Single-shot dispatch spreads `result.files` into return

**4. `improveCopyNode` automatically benefits** (`langgraph_app/app/nodes/website/improveCopy.ts`)
- Already does `return await createCodingAgent(...)` → returns `Partial<WebsiteGraphState>` → `files` flows to graph state

### RED/GREEN/REFACTOR

**RED phase:**
- Added test: `"returns files map from successful edits for progressive streaming"` — mocks `getDirtyPaths` + `readRaw`, asserts `result.files` is defined with normalized content
- Added test: `"does not return files when all edits fail"` — asserts `result.files` is undefined when no edits succeed
- Confirmed first test fails (RED): `expected undefined to be defined`

**GREEN phase:**
- Implemented `collectDirtyFiles()` helper
- Extended return types in `singleShotEdit` and `createCodingAgent`
- All 14 tests pass (14 singleShotEdit), 40 backend tests pass
- 0 new TypeScript errors (7 pre-existing in `recommendDomains.ts`)

### Also resolved
- **Issue A (BaseStateHandler "state leak")** — Investigated and confirmed NOT A BUG. State updates from subagents MUST propagate for progressive streaming. The original empty-todo issue was `afterModel` (fixed in Exp 10). Existing test `subagent-filtering.test.ts:215` explicitly verifies "state updates propagate regardless of namespace."

### Files modified
1. `langgraph_app/app/nodes/coding/singleShotEdit.ts` — `collectDirtyFiles()`, return files, retry fallback text
2. `langgraph_app/app/nodes/coding/agent.ts` — pass through `files` from single-shot
3. `langgraph_app/tests/tests/nodes/coding/singleShotEdit.unit.test.ts` — 2 new tests, updated `makeFakeBackend`

---

## Experiment 12: Fix conversation compaction — voice, message type, and thresholds

**Status**: Complete
**Date**: 2026-02-10

### Problems being solved
1. **Conversation summary voice mismatch** — Summary read in agent's voice ("Here's what we've built") but was stored as HumanMessage, confusing the model
2. **Message type confusion** — Summary as HumanMessage could make the agent think the user is a technical co-builder
3. **Overly aggressive compaction** — Old threshold (12 raw messages, keep 6) was wiping most conversation history on reload, losing agent messages and context

### Changes made

**1. Summarizer prompt rewritten for neutral third-person voice**
(`langgraph_app/app/nodes/website/compactConversation.ts`)
- Old prompt allowed LLM to mirror agent voice
- New prompt enforces: "Use 'The user' and 'The assistant' — never 'we', 'I', or 'you'"
- Example tone: "The user requested a landing page for a fitness app. The assistant created Hero, Features, and CTA sections."

**2. Summary stored as AIMessage (not HumanMessage)**
(`langgraph_app/app/nodes/website/compactConversation.ts`)
- Summary is now `new AIMessage({ content: "[Conversation Summary] ...", name: "context" })`
- Correctly attributed as assistant-generated content
- `name: "context"` ensures it's filtered from UI and excluded from `lastAIMessage()`
- **NOT SystemMessage** — `@langchain/anthropic` rejects SystemMessages not at position 0

**3. `lastAIMessage()` excludes context messages**
(`packages/langgraph-ai-sdk/.../message.ts`, `packages/langgraph-ai-sdk/.../stream.ts`)
- `lastAIMessage()` now filters `isContextMessage()` — symmetric with `lastHumanMessage()`
- Prevents summary from being treated as the agent's last response
- `ContextMessage` type widened to `BaseMessage & { name: "context" }` (was `HumanMessage & ...`)
- Inline `lastAIMessage` in `stream.ts` also updated

**4. Thresholds count human turns, not raw messages**
(`langgraph_app/app/nodes/website/compactConversation.ts`)
- `messageThreshold`: 12 → **30 human turns**
- `keepRecent`: 6 → **20 human turns**
- `maxChars`: 100K → **200K**
- Counting logic: only non-context HumanMessages count. Tool calls (AIMessage+ToolMessage groups) are atomic units but don't inflate the turn count.
- A conversation with 20 human turns and heavy tool use (200+ raw messages) still counts as 20 turns.

### Key learnings

- **SystemMessage mid-conversation is illegal in `@langchain/anthropic`.** The provider rejects any SystemMessage not at position 0. This rules out SystemMessage for conversation summaries.
- **AIMessage + `name="context"` is the clean solution.** Correctly attributed, filtered from UI, excluded from `lastAIMessage()`, and allowed at any position.
- **`createContextMessage()` stays as HumanMessage.** It's used by `injectAgentContext` for mid-conversation context injection (brainstorm context, images, domains). These need positional accuracy and multimodal support. Only the compaction summary uses AIMessage.
- **Anthropic prompt caching makes keeping more context cost-effective.** Cached tokens cost 10% of base input price. Keeping 20 human turns of context (vs 6) is marginally more expensive but dramatically improves agent coherence.

### Tests
- 11 compaction tests passing (human turn counting, tool call bundling, maxChars, context removal, summary type)
- 107 SDK tests passing (lastAIMessage context exclusion, isContextMessage with AIMessage)

### Files modified
1. `langgraph_app/app/nodes/website/compactConversation.ts` — prompt + AIMessage + threshold counting
2. `langgraph_app/tests/tests/nodes/website/compactConversation.test.ts` — rewritten for turn-based counting
3. `packages/langgraph-ai-sdk/.../src/message.ts` — `ContextMessage` type, `lastAIMessage` exclusion
4. `packages/langgraph-ai-sdk/.../src/__tests__/message.test.ts` — new assertions
5. `packages/langgraph-ai-sdk/.../src/stream.ts` — inline `lastAIMessage` fix

---

## Historical Summary: Experiments 1-10

### Experiments 1-5: Diagnosing the streaming pipeline (2026-02-10)
- **Exp 1-4:** Baseline observation → config comparison → RawMessageHandler gate → frontend verification. Confirmed SSE pipeline works end-to-end (2,672 chunks over 155s, first chunk at 24ms). Discovered `runStateOnly` is the code path, not `sendMessage`. Text WAS streaming but interleaved with subagent chatter.
- **Exp 5:** Added frontend SSE diagnostic logging. Found todos always `[]` (LLM never called `write_todos`), files only at stream end (71 files via DB read). Backend `RawMessageHandler` can't distinguish parent vs subagent from metadata alone.

### Experiment 6: Subagent interleaving fix (2026-02-10)
- Added `isSubagentNamespace()` filter in `RawMessageHandler` and `OtherToolHandler`. 62% of raw chunks were subagent text → correctly suppressed. Parent text (292 chunks, 11%) arrives at end as wall.

### Experiment 7: Todos flicker fix via langchain patch (2026-02-10)
- `pnpm patch langchain@1.2.17` fixed `MiddlewareNode.invokeMiddleware` spreading `...state` on `void 0` returns. Todos stabilized (8 todos, zero flicker). But preview failed due to export mismatches (default vs named) and tailwind.config.ts CJS syntax error.
- **Patch later removed** — fix went upstream in langchain@1.2.21.

### Experiment 8: Fork deepagents + subagent todo propagation (2026-02-10)
- Forked deepagents into `packages/deepagentsjs` (git submodule). Removed `"todos"` from `EXCLUDED_STATE_KEYS`. Added `todo_id` param + auto-mark logic. Auto-mark fires but todos had no IDs (`no-id:in_progress`) — langchain's `todoListMiddleware` lacked UUID generation.

### Experiment 9: Own todoListMiddleware — afterModel bug found (2026-02-10)
- Moved `todoListMiddleware` into deepagents fork with UUID generation + ReducedValue reducer. Todos now have LLM-provided semantic IDs. **Bug found:** `afterModel` hook creates a separate LangGraph node with stale state, overwriting correct completions back to all-pending after every subagent return.

### Experiment 10: Remove afterModel — todos fully fixed (2026-02-10)
- Removed `afterModel` from our `todoListMiddleware`. **Result:** Zero stale overwrites. Commands go through ReducedValue reducer correctly — 7 sequential merges accumulate all completions. Status-priority protection blocks all downgrades. **Key finding:** parallel tool Commands are batched by `Promise.all()` — all completions arrive at once, not incrementally.

---

## Changes currently in place (to be cleaned up)

### `packages/deepagentsjs` (git submodule — OUR FORK, keep)
- Forked from `git@github.com:launch10/deepagentsjs.git`
- **`src/middleware/todos.ts`** — our `todoListMiddleware` with UUID generation, ReducedValue reducer, NO afterModel
- **`src/middleware/subagents.ts`** — `"todos"` removed from `EXCLUDED_STATE_KEYS`, `todo_id` param + auto-mark logic, enhanced logging
- **`src/middleware/fs.ts`** — already handles `filesUpdate` via `Command({ update: { files } })` when non-null (no changes needed — Exp 13 just enables the upstream path)
- **`src/agent.ts`** — imports `todoListMiddleware` from local `./middleware/todos.js` instead of langchain
- **`src/index.ts`** — exports our `todoListMiddleware`

### `patches/langchain@1.2.17.patch` — **REMOVED** (fixed upstream in langchain@1.2.21)
- ~~Fixes `MiddlewareNode.invokeMiddleware`: `void 0` returns no longer spread `...state`~~
- ~~Also includes `utils.js` null-safety fix for `initializeMiddlewareStates`~~
- Patch deleted, `patchedDependencies` removed from root `package.json`, langchain bumped to 1.2.21

### `langgraph_app/app/annotation/websiteAnnotation.ts` (keep)
- Merge-by-id reducer with status-priority for outer graph's `todos` channel
- Logging prefix: `[outer:todosReducer]`

### `langgraph_app/app/nodes/coding/agent.ts` (keep)
- `todoOverrideMiddleware` — tells LLM to pass `todo_id` when dispatching tasks
- Changed `{ ...options.config, recursionLimit }` → `Object.assign(originalConfig, { recursionLimit })`
- Updated type signatures for `id` field in todos

### `rails_app/.../components/shared/chat/TodoList.tsx` (keep)
- `id?: string` in `TodoItem` interface, used as React key

### `packages/langgraph-ai-sdk/.../src/__tests__/todos-flicker.test.ts` (keep)
- 5 tests verifying updates stream only includes explicitly returned keys
- Tests intentional clear, content updates, no phantom emissions

### `langgraph_app/app/nodes/website/compactConversation.ts` (Exp 12 — keep)
- Summary as AIMessage with `name="context"` (was HumanMessage)
- Neutral third-person summarizer prompt
- Threshold counting by human turns: `messageThreshold: 30`, `keepRecent: 20`, `maxChars: 200_000`

### `packages/langgraph-ai-sdk/.../src/message.ts` (Exp 12 — keep)
- `ContextMessage` type widened to `BaseMessage & { name: "context" }`
- `lastAIMessage()` excludes context messages

### `packages/langgraph-ai-sdk/.../src/stream.ts` (mixed — keep Exp 12 fix, diagnostic remove after verification)
- **Keep:** Inline `lastAIMessage` excludes context messages (Exp 12)
- **Diagnostic:** `RawMessageHandler`: FILTERED/PASSED logging with namespace, node, preview (rate-limited)
- **Diagnostic:** `OtherToolHandler`: FILTERED subagent logging (first 5)
- **Diagnostic:** `BaseStateHandler`: State key logging for todos/files (+ first 5 other keys)
- **Diagnostic:** `LanggraphStreamHandler.stream()`: Summary log at end of stream

### `packages/langgraph-ai-sdk-react/.../langgraphChat.ts` (diagnostic — remove after verification)
- `runStateOnly`: Chunk timing, type counts, data preview (first 5 + every 500th + summary)

### `langgraph_app/app/services/backends/websiteFilesBackend.ts` (Exp 13 — keep)
- `write()` and `edit()` return `filesUpdate` with `{ content: string[], created_at, modified_at }`
- Enables `fs.ts` middleware to create `Command({ update: { files } })` for progressive file streaming

### `shared/state/website.ts` (Exp 13 — keep)
- `filesMerge` reducer normalizes `string[]` → `string` content
- Registered in `WebsiteMergeReducer` for frontend `StateManager`

### `langgraph_app/app/nodes/coding/singleShotEdit.ts` (Exp 13 — keep)
- "Tell, then do" prompt: step 1 is "describe what you'll change" (streams text before tool_use)
- Improved fallback: `"Done! Your changes have been applied."` (was `"I've made the requested changes."`)

### `rails_app/.../BuildStep.tsx`
- Console.log of files, todos, messages on every render (pre-existing debug logging)
