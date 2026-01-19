# Deploy Graph Refactor Plan

## Overview

Refactoring `DeployGraph` into two clean subgraphs:
- `WebsiteDeployGraph` - handles website deployment (instrumentation → validation → fix loop → deploy)
- `CampaignDeployGraph` - handles campaign deployment (single async task)

Parent `DeployGraph` orchestrates both, running them in sequence when needed.

## Architecture

```
DeployGraph (orchestrator)
├── WebsiteDeployGraph (subgraph)
│   ├── instrumentation
│   ├── runtimeValidation
│   ├── fixWithCodingAgent (loop)
│   └── deployWebsite (async → Sidekiq)
│
└── CampaignDeployGraph (subgraph)
    └── deployCampaign (async → Sidekiq)
```

## Key Design Decisions

### 1. Shared Annotation
All graphs use `DeployAnnotation` with the same `tasks` reducer. Tasks from subgraphs automatically bubble up to parent.

### 2. Task-Based State
All state lives on tasks themselves:
- `task.status` = "pending" | "running" | "passed" | "failed" | "completed"
- `task.retryCount` = number of retry attempts
- `task.result` = webhook result data
- `task.error` = error message if failed

### 3. Enqueue Edges (Frontend Visibility)

**Problem:** If we create task + fire job in one node, frontend never sees intermediate states.

**Solution:** Split async tasks into discrete steps via conditional edges:

```
[Does task exist?]
    │
    ├── No → createTaskNode (status: "pending") → END
    │
    └── Yes → [Is task pending?]
                  │
                  ├── Yes → enqueueNode (fires job → status: "running") → END
                  │
                  └── No → [Is task running with result?]
                              │
                              ├── Yes → completeNode (status: "completed") → next
                              │
                              └── No (still running) → END (wait for webhook)
```

**Frontend sees every transition:**
```
Poll 1 → "pending"   (task created, job not yet fired)
Poll 2 → "running"   (job fired, waiting for completion)
Poll 3 → "running"   (still waiting...)
Webhook arrives
Poll 4 → "completed" (proceed to next step)
```

This pattern applies to any async Sidekiq task:
- `WebsiteDeploy`
- `CampaignDeploy`
- `RuntimeValidation` (if we make it async)

### 4. Orchestration via Polling
Frontend polls the graph. Each invocation:
1. Checks task states
2. If `WebsiteDeploy.status === "completed"` → proceed to campaign
3. If still in progress → exit early (idempotent)

### 5. Webhook → Next Graph Trigger
```
[Graph Run 1] → Creates WebsiteDeploy task (pending) → exits
                     ↓
              [Sidekiq runs job]
                     ↓
              [Webhook callback] → marks task completed
                     ↓
[Graph Run 2] → Sees WebsiteDeploy completed → triggers CampaignDeploy
```

---

## Tests Needed

### A. Task Bubbling (Unit)
- [ ] Tasks created in `WebsiteDeployGraph` appear in parent's `tasks[]`
- [ ] Tasks created in `CampaignDeployGraph` appear in parent's `tasks[]`
- [ ] Task reducer merges correctly (updates existing, adds new)

### B. Idempotency (Unit)
- [ ] `WebsiteDeployGraph` exits early if `WebsiteDeploy` task exists
- [ ] `CampaignDeployGraph` exits early if `CampaignDeploy` task exists
- [ ] Re-invoking a completed graph is a no-op

### C. Orchestration Flow (Integration)
- [ ] Website-only deploy: `{ deploy: { website: true } }` → only runs website flow
- [ ] Campaign-only deploy: `{ deploy: { googleAds: true } }` → skips website, runs campaign
- [ ] Both deploy: `{ deploy: { website: true, googleAds: true } }` → runs website first, then campaign

### D. Webhook → Next Graph Trigger (Integration)
- [ ] Run 1: Creates `WebsiteDeploy` task with status "pending", exits
- [ ] Simulate webhook: Update task to status "completed"
- [ ] Run 2: Sees completed website, triggers `CampaignDeployGraph`
- [ ] Run 2: Creates `CampaignDeploy` task with status "pending"

### E. Enqueue Edges - Frontend Visibility (Integration)
- [ ] Poll 1: Task doesn't exist → creates task with "pending" → exits
- [ ] Poll 2: Task is "pending" → fires Sidekiq job → marks "running" → exits
- [ ] Poll 3: Task is "running", no result → exits (idempotent wait)
- [ ] Webhook: Updates task with result
- [ ] Poll 4: Task is "running" with result → marks "completed" → proceeds
- [ ] Verify frontend can observe each state transition distinctly

### F. Failure Handling (Integration)
- [ ] Website deploy fails → does NOT proceed to campaign
- [ ] Campaign deploy fails → graph status is "failed"
- [ ] Retry loop exhausted → proceeds to deploy anyway (or fails gracefully?)

---

## Refactoring Tasks

### 1. Clean up `deployCampaign.ts`
Current state: Duplicates entire website flow
Target state: Campaign-only (single node + idempotency check)

**Remove:**
- `instrumentationNode`
- `runtimeValidationNode`
- `fixWithCodingAgentNode`
- `deployWebsiteNode`
- References to `state.validationPassed`, `state.retryCount`, `state.deployGoogleAds`

**Keep:**
- `deployCampaignNode`
- Idempotency check at START

### 2. Update `deploy.ts` orchestrator
Add conditional edge after `deployWebsite`:
```typescript
.addConditionalEdges("deployWebsite", (state) => {
  const task = Task.findTask(state.tasks, "WebsiteDeploy");
  if (task?.status === "failed") return END;
  if (task?.status !== "completed") return END; // still in progress
  if (Deploy.shouldDeployGoogleAds(state)) return "deployCampaign";
  return END;
})
```

### 3. Implement Enqueue Edge Pattern
Refactor async nodes to use the enqueue edge pattern for frontend visibility:

**Before (current):**
```typescript
// deployWebsiteNode does everything in one shot
if (!task) {
  const newTask = Task.createTask("WebsiteDeploy");
  await JobRunAPIService.create(...);
  return { tasks: [{ ...newTask, status: "running" }] };
}
```

**After (enqueue edges):**
```typescript
// Graph level - conditional edges control flow
.addConditionalEdges("checkWebsiteDeploy", (state) => {
  const task = Task.findTask(state.tasks, "WebsiteDeploy");
  if (!task) return "createWebsiteDeployTask";
  if (task.status === "pending") return "enqueueWebsiteDeploy";
  if (task.status === "running" && task.result) return "completeWebsiteDeploy";
  if (task.status === "running") return END; // waiting for webhook
  return "nextStep"; // completed
})

// createWebsiteDeployTask - just creates task
const createWebsiteDeployTask = (state) => ({
  tasks: [Task.createTask("WebsiteDeploy")] // status: "pending"
});

// enqueueWebsiteDeploy - fires job, marks running
const enqueueWebsiteDeploy = async (state) => {
  await JobRunAPIService.create(...);
  return { tasks: [{ name: "WebsiteDeploy", status: "running" }] };
};

// completeWebsiteDeploy - processes result, marks completed
const completeWebsiteDeploy = (state) => {
  const task = Task.findTask(state.tasks, "WebsiteDeploy");
  return { tasks: [{ name: "WebsiteDeploy", status: "completed", result: task.result }] };
};
```

### 4. Add comprehensive tests
See "Tests Needed" section above.

---

## Open Questions

1. **Failure behavior**: If website deploy fails, should we:
   - a) Stop entirely (current plan)
   - b) Still attempt campaign deploy
   - c) Let user decide via flag

2. **Retry exhaustion**: If validation fails after max retries, should we:
   - a) Deploy anyway (current behavior)
   - b) Fail the entire flow
   - c) Deploy but mark as "deployed_with_errors"

---

## Status

- [x] Analyze current architecture
- [x] Document enqueue edge pattern for frontend visibility
- [x] Write tests for task bubbling
- [x] Write tests for webhook → next graph trigger
- [x] Write tests for idempotency (early exit when WebsiteDeploy task exists)
- [ ] Write tests for enqueue edge pattern (pending → running → completed) - *3 tests skipped, target behavior*
- [ ] Implement enqueue edge pattern for `WebsiteDeploy`
- [ ] Implement enqueue edge pattern for `CampaignDeploy`
- [ ] Refactor `deployCampaign.ts` to be campaign-only
- [x] Update `deploy.ts` orchestrator logic
- [x] Fix import issues (namespace imports for Task helpers)
- [x] Verify all current tests pass (7 passing, 3 skipped)

## Completed Fixes

### Import Pattern Fix
Files fixed to use namespace imports:
- `app/nodes/deploy/deployWebsiteNode.ts` - Changed `import { createTask, findTask, updateTask }` to `import { Task }` with `Task.findTask()`, etc.
- `app/nodes/deploy/fixWithCodingAgentNode.ts` - Added `Task.` prefix to `updateTask()` calls
- `app/server/routes/webhooks/jobRunCallback.ts` - Changed `import { updateTask, type Task }` to `import { Task }` with proper namespace usage

### Test File Created
`tests/tests/graphs/deploy/deployWebsite.test.ts` - Comprehensive test suite for:
- Idempotency (early exit when WebsiteDeploy task exists with any status)
- Task bubbling (tasks accumulate correctly)
- Webhook integration (fire-and-forget + callback pattern)
- Validation flow (retry loop, max retries)
- Enqueue edge pattern (3 skipped tests for target behavior)
