# Runbook: Diagnosing Deploy Page Frontend Issues

## Context

The Deploy page (`Deploy.tsx`) can show incorrect UI state — e.g. "Preparing deployment..." sidebar alongside a completed deployment history. The **sidebar** and **content screen** are driven by **two independent state sources** that can be out of sync:

- **Content screen** (`useDeployContentScreen`): resolved from Rails `deploy.status` (immediate on page load) OR Langgraph `state.status` (arrives async)
- **Sidebar** (`DeploySidebar`): driven solely by `useDeployChatState("tasks")` from Langgraph — empty array = "Preparing deployment..."

### State Loading Architecture

The SDK (`langgraph-ai-sdk-react`) has auto-history loading:

1. `useLanggraph` checks `chat.isNewChat` (false when `threadId` is provided from page props)
2. If not new, it calls `chat.loadHistoryOnce()` — a GET to `/api/deploy/stream?threadId=<id>`
3. The server calls `graph.getState({ thread_id })` to fetch the full checkpoint state (including `tasks`, `status`, `result`)
4. On response, `HistoryLoader.onStateLoaded(state)` calls `StateManager.loadState(state)` which merges history into local state

For terminal deploys: `thread_id` is in page props -> `isNewChat = false` -> auto-history fires -> tasks should populate.

**Suspected race condition**: Rails `deploy.status = "completed"` renders the DeployCompleteScreen immediately (synchronous), while Langgraph history loading is async (network fetch). The sidebar shows "Preparing deployment..." in the gap before history loads.

---

## Part 1: Database Artifacts to Query

### 1a. The deploy Rails serves to the page

```sql
-- The controller runs: @project.deploys.current_for(:google_ads).last
SELECT id, status, active, is_live, instructions, thread_id,
       current_step, created_at, finished_at,
       (finished_at - created_at) AS duration
FROM deploys
WHERE project_id = <PROJECT_ID>
  AND active = true
  AND deleted_at IS NULL
  AND instructions @> '{"google_ads": true}'
ORDER BY id DESC
LIMIT 1;
```

**What to look for:**
- `status` — What the frontend receives as `deploy.status` (drives content screen)
- `active` — Must be `true`
- `instructions` — Must match page expectations (`{"google_ads": true}` or `{"website": true}`)
- `thread_id` — Links to Langgraph checkpoint

### 1b. The thread_id in page props (drives history loading)

```sql
-- The serializer resolves thread_id from project.current_chat.thread_id
-- For the deploy page (step="deploy"), it finds the google_ads deploy's chat
SELECT c.thread_id, c.chat_type, c.active, c.contextable_type, c.contextable_id, d.status as deploy_status
FROM chats c
JOIN deploys d ON d.id = c.contextable_id AND c.contextable_type = 'Deploy'
WHERE d.project_id = <PROJECT_ID>
  AND d.active = true
  AND d.instructions @> '{"google_ads": true}'
  AND c.active = true
ORDER BY d.id DESC
LIMIT 1;
```

**What to look for:**
- `thread_id` not null -> SDK will auto-load history (isNewChat = false)
- `thread_id` null -> SDK creates new thread, no history loaded, sidebar stays empty
- `chat.active` = true -> Chat is accessible

### 1c. Check for conflicting deploys

```sql
-- Should be exactly 1 active deploy per project
SELECT id, status, active, is_live, instructions, thread_id, created_at
FROM deploys
WHERE project_id = <PROJECT_ID>
  AND active = true
  AND deleted_at IS NULL
ORDER BY id DESC;
```

### 1d. Verify Langgraph checkpoint has tasks

```sql
-- Check the actual checkpoint state for this thread
SELECT thread_id,
       checkpoint_id,
       (checkpoint->'channel_values'->>'status') as graph_status,
       jsonb_array_length(checkpoint->'channel_values'->'tasks') as task_count
FROM checkpoints
WHERE thread_id = '<THREAD_ID>'
ORDER BY checkpoint_id DESC
LIMIT 1;
```

**What to look for:**
- `graph_status` = "completed" — Graph finished
- `task_count` > 0 — Tasks exist in checkpoint (history loading should return these)
- `task_count` = 0 or null — No tasks saved in checkpoint -> history loading won't help

### 1e. Deploy history API data

```sql
SELECT id, status, is_live, instructions, created_at, finished_at
FROM deploys
WHERE project_id = <PROJECT_ID>
  AND deleted_at IS NULL
  AND status IN ('completed', 'failed')
ORDER BY created_at DESC
LIMIT 10;
```

---

## Part 2: Browser Automation Artifacts (Playwright MCP)

### 2a. Check Inertia page props

After navigating to `/projects/<uuid>/deploy`, run in console:

```javascript
// Extract the Inertia page props Rails sent
const pageData = JSON.parse(document.querySelector('[data-page]').dataset.page);
console.table({
  deploy_status: pageData.props.deploy?.status,
  deploy_id: pageData.props.deploy?.id,
  deploy_instructions: JSON.stringify(pageData.props.deploy?.instructions),
  thread_id: pageData.props.thread_id,  // null = new chat, no history
  has_website_url: !!pageData.props.website_url,
});
```

**Critical check**: `thread_id` — if null, no history will load, explaining empty tasks.

### 2b. Check existing console logs

With `VITE_LOG_LEVEL=debug`, the logger outputs:
- `[DeployInit] deploy prop:` — shows the Rails deploy prop
- `[DeployInit] Terminal state, skipping init` — deploy.status was completed/failed
- `[DeployInit] Resuming in-progress deploy` — deploy.status was pending/running
- `[DeployInit] Starting fresh deploy` — no deploy found
- `[DeploySidebar] tasks:` — check if tasks ever populate
- `[DeployScreen] resolved:` — which content screen was selected and why

### 2c. Monitor history loading network request

```javascript
// In browser console, watch for the history GET request:
// GET /api/deploy/stream?threadId=<uuid>
//
// Check:
// 1. Does the request fire? (If not, thread_id is null or isNewChat is true)
// 2. Does the response include state.tasks?
// 3. What's the response time? (If slow, sidebar shows "Preparing" during load)
```

### 2d. Time the race condition

```javascript
// Add a performance observer to measure the gap
const start = performance.now();
const observer = new MutationObserver(() => {
  const sidebar = document.querySelector('[class*="Checklist"]');
  if (sidebar?.textContent?.includes('Preparing')) {
    console.log(`[RACE] Sidebar still "Preparing" at ${(performance.now() - start).toFixed(0)}ms`);
  }
});
observer.observe(document.body, { subtree: true, childList: true, characterData: true });
```

### 2e. Take sequential screenshots

```
1. Navigate to /projects/<uuid>/deploy
2. Screenshot immediately (T+0)
3. Wait 2 seconds, screenshot (T+2s)
4. Wait 5 seconds, screenshot (T+5s)
5. Compare: Does sidebar update from "Preparing" to checklist after history loads?
```

If sidebar stays "Preparing" after 5s -> history loading failed (not just race condition).

---

## Part 3: Frontend Logger

A `VITE_LOG_LEVEL`-controlled logger is available at `app/javascript/frontend/lib/logger.ts`.

### Activation

| Environment | Default Level | What you see |
|-------------|--------------|--------------|
| Production | `error` | Nothing |
| Development | `info` | Init path decisions only |
| Debug session | `debug` | All state transitions + resolved screens |
| Deep trace | `trace` | Full state dumps on every update |

**Enable at runtime** (no rebuild needed):
```javascript
window.__LOG_LEVEL__ = "debug"  // then navigate to deploy page
```

**Enable at build time:**
```bash
VITE_LOG_LEVEL=debug bin/dev
```

### Instrumented files

| File | Level | What it logs |
|------|-------|-------------|
| `useDeployInit.ts` | `debug`/`info` | Deploy prop, init path (resume/terminal/fresh) |
| `useDeployContentScreen.ts` | `debug` | Resolved screen + input snapshot |
| `DeploySidebar.tsx` | `debug` | Tasks array on each render |
| `useDeployChat.ts` | `trace` | ThreadId resolution |

---

## Part 4: Diagnosis Decision Tree

```
1. Navigate to /projects/<uuid>/deploy
   |
2. Check Inertia page props (step 2a)
   +-- thread_id is present -> History loading should fire -> Go to step 3
   +-- thread_id is NULL -> No history loading -> sidebar will always show "Preparing"
       +-- Query 1b: Is the deploy's chat active? Is chat.thread_id set?
   |
3. Check network tab for GET /api/deploy/stream?threadId=<id>
   +-- Request fires, response 200 with state.tasks -> History loaded correctly -> Go to step 4
   +-- Request fires, response 200 but state.tasks empty/missing -> Checkpoint has no tasks
   |   +-- Query 1d: Check checkpoint for task_count
   +-- Request fires, response 4xx/5xx -> Auth issue or thread validation failed
   |   +-- Check server logs for error details
   +-- Request never fires -> isNewChat is true despite threadId
       +-- Check if resolvedDeployThreadId cache is stale (useDeployChat.ts line 30)
   |
4. Check console: do tasks eventually populate?
   +-- Yes (after delay) -> RACE CONDITION: Content screen renders before history loads
   |   +-- This is the suspected bug from the screenshot
   +-- No (never populate) -> History loaded but StateManager.loadState didn't set tasks
       +-- Check if localState already had tasks = undefined (spread wins for explicit keys)
   |
5. For the race condition case:
   +-- Rails deploy.status = "completed" -> DeployCompleteScreen renders immediately
       Langgraph tasks = undefined (history still loading) -> Sidebar shows "Preparing"
       After ~200-500ms: history loads, tasks populate, sidebar updates
       User sees the flash of "Preparing" with completed content
```

---

## Part 5: Root Cause Analysis (Reference)

The content screen and sidebar are driven by different sources with different timing:

```
T+0ms    Rails props arrive: deploy.status = "completed"
         -> Content screen: DeployCompleteScreen (correct)
         -> Sidebar tasks: undefined -> "Preparing deployment..." (incorrect)

T+0ms    SDK starts: isNewChat = false, begins history loading (async GET)

T+200ms  History response arrives with tasks + status
         -> StateManager.loadState(historyState)
         -> tasks populate -> sidebar re-renders with checklist (correct)
```

For terminal deploys (line 57-62 in `useDeployInit.ts`), `updateState` is NOT called — it relies on SDK auto-history loading, which is async. The mismatch is the 0-200ms gap before history loads.
