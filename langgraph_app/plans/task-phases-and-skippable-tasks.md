# Task Phases & Skippable Tasks

## Problem Statement

### Problem 1: Task Granularity Mismatch

- **Backend needs**: Granular tasks (`ValidateLinks`, `RuntimeValidation`, `BugFix`) for tracking actual work
- **Frontend wants**: High-level stages like "Preparing your website" → "Checking for bugs" → "Deploying"

### Problem 2: Skippable Tasks

- Some tasks are only needed once (e.g., `GoogleConnect` after initial OAuth)
- Currently we'd enqueue then immediately skip - wasteful and confusing for users

---

## Solution 1: Computed Phases

### Architecture

Keep tasks exactly as-is (granular, backend-focused), but compute "phases" as a read-only abstraction:

```typescript
// shared/types/phase.ts
export const PhaseDefinitions = {
  Preparation: {
    description: "Preparing your website",
    tasks: ["Instrumentation", "SEOOptimization"],
  },
  Validation: {
    description: "Checking for bugs",
    tasks: ["ValidateLinks", "RuntimeValidation", "BugFix"],
  },
  Deployment: {
    description: "Deploying to the web",
    tasks: ["WebsiteDeploy"],
  },
} as const;

export function computePhases(tasks: Task[]): Phase[] {
  return Object.entries(PhaseDefinitions).map(([name, def]) => {
    const childTasks = tasks.filter((t) => def.tasks.includes(t.name));
    return {
      name,
      description: def.description,
      status: computeStatus(childTasks),
      progress: childTasks.filter((t) => t.status === "completed").length / def.tasks.length,
    };
  });
}
```

### Implementation: Option B (Computed in Annotation)

Add `phases` as a derived field in DeployAnnotation:

```typescript
// deployAnnotation.ts
phases: Annotation<Phase[]>({
  default: () => [],
  reducer: (_, __, fullState) => {
    return computePhases(fullState.tasks);
  },
});
```

### Frontend Display

```
┌─────────────────────────┬───────────┬──────────┐
│ Preparing your website  │ completed │ 100%     │
│ Checking for bugs       │ running   │ 66%      │
│ Deploying to the web    │ pending   │ 0%       │
└─────────────────────────┴───────────┴──────────┘
```

### Benefits

1. Backend keeps granular tasks for tracking/debugging
2. Frontend gets clean phases automatically computed
3. Single source of truth - phase definitions live in one place
4. Progressive disclosure - can expand phases to show child tasks

---

## Solution 2: Skippable Tasks via Conditional Routing

### Principle: Never Enqueue What You Won't Run

Instead of:

```
Enqueue GoogleConnect → GoogleConnect (checks if needed, skips) → Next
```

Do:

```
Conditional Edge: needsGoogleConnect?
  → YES: Enqueue GoogleConnect → GoogleConnect → Next
  → NO: Next (skip entirely)
```

### Implementation Pattern

```typescript
// In graph definition
.addConditionalEdges("previousNode", async (state) => {
  // Check if Google is already connected
  const adsAccount = await adsAccountApi.findByAccountId(state.accountId);

  if (adsAccount?.connected) {
    return "skipToNextPhase";  // Never enqueue GoogleConnect
  }
  return "enqueueGoogleConnect";  // Only enqueue if needed
})
```

### Graph Visualization

```
                    ┌─────────────────┐
                    │  Previous Node  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ needsConnect?   │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │ YES            │                │ NO
            ▼                │                ▼
   ┌─────────────────┐       │       ┌─────────────────┐
   │ Enqueue Google  │       │       │   Next Phase    │
   │    Connect      │       │       │   (skip OAuth)  │
   └────────┬────────┘       │       └─────────────────┘
            │                │
            ▼                │
   ┌─────────────────┐       │
   │ GoogleConnect   │───────┘
   │     Node        │
   └─────────────────┘
```

### Skippable Task Candidates

| Task                   | Skip Condition       | Check Method                            |
| ---------------------- | -------------------- | --------------------------------------- |
| `GoogleConnect`        | Already connected    | `adsAccountApi.findByAccountId()`       |
| `GoogleVerify`         | Already verified     | `adsAccount.verified === true`          |
| `GoogleBillingConnect` | Billing already set  | `adsAccount.billing_connected === true` |
| `Instrumentation`      | Already instrumented | Check for analytics script in code      |
| `SEOOptimization`      | Already optimized    | Check for meta tags in code             |

### Benefits

1. Cleaner task array - only contains tasks that actually ran
2. No confusing "completed instantly" tasks in frontend
3. Graph logic is explicit about what's conditional
4. Easier to reason about what work was actually done

---

## Implementation Plan

### Phase 1: Computed Phases ✅ DONE

1. [x] Create `shared/types/phase.ts` with PhaseDefinitions
2. [x] Add `computePhases()` function
3. [x] Add `phases` to DeployAnnotation
4. [x] Add `withPhases()` helper for nodes
5. [x] Update `createEnqueueNode` to compute phases
6. [ ] Update frontend to display phases instead of raw tasks

### Phase 2: Skippable Tasks ✅ DONE (GoogleConnect)

1. [ ] Add `adsAccountApi.findByAccountId()` endpoint (TODO: real API)
2. [x] Refactor deployCampaign graph with conditional routing
3. [x] Add `googleConnectNode` with `shouldSkipGoogleConnect` router
4. [ ] Apply pattern to GoogleVerify, GoogleBillingConnect
5. [ ] Consider applying to Instrumentation/SEO if already done

### Phase 3: Polish

1. [ ] Add "expand to see details" UI for phases
2. [ ] Handle edge cases (partial completion, retries)
3. [ ] Add phase-level error messages

---

## What Was Built

### Files Created/Modified:

**New Files:**

- `shared/types/phase.ts` - Phase types, definitions, and computation helpers
- `langgraph_app/app/nodes/deploy/googleConnectNode.ts` - Skippable task with conditional routing
- `langgraph_app/tests/tests/types/phase.test.ts` - 30 tests for phase logic
- `langgraph_app/tests/tests/graphs/deploy/deployCampaign.test.ts` - 5 tests for skippable tasks

**Modified Files:**

- `shared/types/index.ts` - Export Phase namespace
- `langgraph_app/app/annotation/deployAnnotation.ts` - Added phases field and helpers
- `langgraph_app/app/nodes/deploy/createEnqueueNode.ts` - Now computes phases
- `langgraph_app/app/nodes/deploy/index.ts` - Export googleConnectNode
- `langgraph_app/app/graphs/deployCampaign.ts` - Conditional routing for GoogleConnect

### Usage Examples:

**Using withPhases in nodes:**

```typescript
return withPhases(state, [{ ...task, status: "completed" }], ["Preparation", "Validation"]);
```

**Conditional routing for skippable tasks:**

```typescript
.addConditionalEdges(START, shouldSkipGoogleConnect, {
  skipGoogleConnect: "enqueueDeployCampaign",
  enqueueGoogleConnect: "enqueueGoogleConnect",
})
```

---

## Open Questions

1. Should phases include tasks that were skipped? (e.g., "OAuth: Skipped - already connected")
   - **Current answer**: No - if skipped, no task exists, phase stays "pending"
2. Should we track _why_ a task was skipped in state for debugging?
   - **Current answer**: No - YAGNI. Can add `skippedTasks` array later if needed.
3. How do we handle retries at the phase level vs task level?
   - **Current answer**: Phase status derives from tasks. If a task retries, phase shows "running".
