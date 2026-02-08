# Plan: Pre-Deployment Runtime Validation (Layer 2)

## Summary

Runtime validation that runs as part of `deployGraph` before website goes live. This catches issues that static analysis misses by actually running the site in a browser.

**Integration Point:** `runtimeValidationNode` in `deployGraph`

## Dependencies

- **`plans/browser-pool.md`** - Browser pool infrastructure (port 0, lazy pool, bounded concurrency)
- **`plans/coding-agent-static-validation.md`** - Layer 1 static checks should pass first
- **`plans/website-deploy-graph.md`** - deployGraph that orchestrates this validation (must create `DeployAnnotation` and `deploy.ts` first)

## Architecture Context

Per `architecture-overview.md`:

- **LangGraph orchestrates** - `deployGraph` runs validation, routes to fix node on failure
- **Rails executes** - Just builds and uploads, no validation logic

```
deployGraph
├── analyticsNode     # Inject tracking
├── runtimeValidationNode   # <-- THIS PLAN (validates BEFORE deploy)
├── fixWithCodingAgentNode  # Fix errors via codingAgentGraph
├── deployWebsiteNode       # Build + upload to R2
└── deployCampaignNode      # Google Ads (if enabled)
```

**Key insight:** Validate before deploying, not after. This avoids paying for R2 deploy on each retry.

---

## Current State

**Existing infrastructure (after browser-pool.md is implemented):**

- `ErrorExporter` - Orchestrates FileExporter → WebsiteRunner → BrowserErrorCapture
- `BrowserErrorCapture` - Uses browser pool for Playwright-based console error capture
- `WebsiteRunner` - Runs dev servers on dynamic ports (port 0)
- `FileExporter` - Exports files to /tmp for validation
- `browserPool` - Singleton with bounded concurrency (see `browser-pool.md`)

**ErrorExporter API:**

```typescript
// Constructor takes websiteId
const exporter = new ErrorExporter(websiteId: number);

// run() returns ConsoleError[] from @types (type, message, location?, timestamp)
const errors = await exporter.run();

// Implements AsyncDisposable for cleanup
await using exporter = new ErrorExporter(websiteId);
```

---

## Validation Checks

Runtime validation focuses on what static validation cannot catch:

| Check             | How                              |
| ----------------- | -------------------------------- |
| Page loads        | Navigate to `/`, verify no crash |
| No console errors | Capture `console.error` calls    |

**Note:** Route checking is handled by static validation. Runtime validation trusts that routes are valid and focuses on JavaScript runtime errors.

### Future Checks (Not in Scope)

- Failed network request monitoring
- Screenshot comparison against design
- Accessibility audit (axe-core)
- Performance metrics (LCP, CLS)
- Mobile responsiveness

---

## Implementation

### runtimeValidationNode

**File:** `langgraph_app/app/nodes/deploy/runtimeValidationNode.ts`

```typescript
import { DeployAnnotation } from "@annotation";
import type { ConsoleError } from "@types"; // NOT @annotation - different type shape
import { ErrorExporter } from "@services/editor/errors/errorExporter";

export const runtimeValidationNode = async (
  state: typeof DeployAnnotation.State
): Promise<Partial<typeof DeployAnnotation.State>> => {
  // Use await using for proper cleanup (AsyncDisposable)
  await using exporter = new ErrorExporter(state.websiteId);

  const errors = await exporter.run();

  return {
    validationPassed: errors.length === 0,
    consoleErrors: errors,
  };
};
```

**Note:** No timeout wrapper needed. Playwright and WebsiteRunner have their own timeouts (30s each). Browser pool handles bounded concurrency.

### Graph Routing

**File:** `langgraph_app/app/graphs/deploy.ts` (excerpt)

```typescript
graph
  .addNode("runtimeValidation", runtimeValidationNode)
  .addConditionalEdges("runtimeValidation", (state) => {
    if (state.validationPassed) {
      return "deployWebsite";
    }
    // Validation failed - route to fix node
    return "fixWithCodingAgent";
  })
  .addEdge("fixWithCodingAgent", "runtimeValidation"); // Loop back after fix
```

### fixWithCodingAgentNode

This node already exists as part of the deployGraph infrastructure. It invokes `codingAgentGraph` with error context and loops back to validation.

---

## DeployAnnotation Requirements

The following fields must be added to `DeployAnnotation` (see `website-deploy-graph.md`):

```typescript
// Required by runtimeValidationNode
websiteId: number;
validationPassed: boolean;
consoleErrors: ConsoleError[];
```

---

## Files Summary

| Action | File                                                            |
| ------ | --------------------------------------------------------------- |
| Create | `langgraph_app/app/nodes/deploy/runtimeValidationNode.ts`       |
| Modify | `langgraph_app/app/graphs/deploy.ts` (add node + routing)       |
| Modify | `langgraph_app/app/annotation/deployAnnotation.ts` (add fields) |

**Prerequisites:** Implement `browser-pool.md` first.

**Note:** `fixWithCodingAgentNode` is part of the deployGraph infrastructure, not this plan.

---

## Verification

1. **Unit test:** Create website with console error → validation fails → `consoleErrors` populated
2. **Unit test:** Create clean website → validation passes → `validationPassed: true`
3. **Integration test:** Validation failure → fix node invoked → re-validation → success
4. **Concurrency test:** 3 simultaneous validations → all complete (browser pool handles concurrency)
