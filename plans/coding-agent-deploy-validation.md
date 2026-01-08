# Plan: Pre-Deployment Runtime Validation (Layer 2)

## Summary

Runtime validation that runs as part of `deployGraph` before website goes live. This catches issues that static analysis misses by actually running the site in a browser.

**Integration Point:** `runtimeValidationNode` in `deployGraph`

## Dependencies

- **`plans/coding-agent-static-validation.md`** - Layer 1 static checks should pass first
- **`plans/website-deploy-graph.md`** - deployGraph that orchestrates this validation (must create `DeployAnnotation` and `deploy.ts` first)

## Architecture Context

Per `architecture-overview.md`:

- **LangGraph orchestrates** - `deployGraph` runs validation, uses LangGraph built-in retries
- **Rails executes** - Just builds and uploads, no validation logic

```
deployGraph
├── instrumentationNode     # Inject tracking
├── runtimeValidationNode   # <-- THIS PLAN (validates BEFORE deploy)
├── fixWithCodingAgentNode  # Fix errors via codingAgentGraph
├── deployWebsiteNode       # Build + upload to R2
└── deployCampaignNode      # Google Ads (if enabled)
```

**Key insight:** Validate before deploying, not after. This avoids paying for R2 deploy on each retry.

---

## Current State

**Existing infrastructure to reuse:**

- `ErrorExporter` - Orchestrates FileExporter → WebsiteRunner → BrowserErrorCapture
- `BrowserErrorCapture` - Playwright-based console error capture
- `WebsiteRunner` - Runs dev servers in isolation
- `FileExporter` - Exports files to /tmp for validation

**Actual ErrorExporter API:**
```typescript
// Constructor takes websiteId
const exporter = new ErrorExporter(websiteId: number);

// run() returns ConsoleError[] (message, stack?, timestamp)
const errors = await exporter.run();

// Implements AsyncDisposable for cleanup
await using exporter = new ErrorExporter(websiteId);
```

---

## Prerequisites (Infrastructure Changes)

### 1. Dynamic Port Allocation

**Problem:** `WebsiteRunner` defaults to port 5173. Concurrent validations would conflict.

**Solution:** Use port 0 to let OS assign an available port.

**File:** `langgraph_app/app/services/editor/core/websiteRunner.ts`

```typescript
// Change default from 5173 to 0
constructor(projectDir: string, port: number = 0) {
  // Vite will pick an available port
  // Existing stdout parsing already captures actual port (lines 87-91)
}
```

### 2. Lazy Browser Pool

**Problem:** Each validation launches a new Chromium instance (~200MB RAM). Concurrent deploys cause:
- Memory pressure (10 deploys = ~2GB just for browsers)
- Orphaned browser processes if cleanup fails
- CPU contention during browser startup

**Solution:** Singleton browser pool with lazy initialization. Reuse one browser with multiple contexts.

**File:** `langgraph_app/app/services/editor/errors/browserPool.ts` (new)

```typescript
import { chromium, type Browser, type BrowserContext } from "playwright";

/**
 * Singleton browser pool with lazy initialization.
 *
 * One browser per worker process, multiple contexts for isolation.
 * Contexts are lightweight (~10MB) vs full browsers (~200MB).
 */
class BrowserPool {
  private browser: Browser | null = null;
  private contextCount = 0;

  async getContext(): Promise<BrowserContext> {
    if (!this.browser) {
      console.log("Launching browser pool...");
      this.browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }
    this.contextCount++;
    return this.browser.newContext();
  }

  async releaseContext(context: BrowserContext): Promise<void> {
    await context.close();
    this.contextCount--;
  }

  async shutdown(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log("Browser pool shut down");
    }
  }
}

// Singleton instance
export const browserPool = new BrowserPool();
```

**File:** `langgraph_app/app/services/editor/errors/browserErrorCapture.ts` (modify)

```typescript
import { browserPool } from "./browserPool";

export class BrowserErrorCapture {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  // ... remove browser field, use context from pool

  async start(): Promise<void> {
    this.context = await browserPool.getContext();
    this.page = await this.context.newPage();
    // ... rest unchanged
  }

  async stop(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.context) {
      await browserPool.releaseContext(this.context);
      this.context = null;
    }
  }
}
```

**Why lazy init:** Deploys aren't constant. Browser only launches on first validation, then stays running for subsequent ones. First validation has ~2-3s cold start, rest are fast.

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

Uses the existing `ConsoleError` type from `@annotation` - no new types needed.

```typescript
import { DeployAnnotation, ConsoleError } from "@annotation";
import { ErrorExporter } from "@services/editor/errors/errorExporter";

const VALIDATION_TIMEOUT_MS = 120_000; // 2 minutes max

export const runtimeValidationNode = async (
  state: typeof DeployAnnotation.State
): Promise<Partial<typeof DeployAnnotation.State>> => {
  // Use await using for proper cleanup (AsyncDisposable)
  await using exporter = new ErrorExporter(state.websiteId);

  // Run with timeout
  const errors = await Promise.race([
    exporter.run(),
    new Promise<ConsoleError[]>((_, reject) =>
      setTimeout(() => reject(new Error("Validation timeout")), VALIDATION_TIMEOUT_MS)
    ),
  ]);

  return {
    validationPassed: errors.length === 0,
    consoleErrors: errors,
  };
};
```

### Graph Retries

Use LangGraph's built-in retry mechanism instead of reinventing retry logic:

**File:** `langgraph_app/app/graphs/deploy.ts` (excerpt)

```typescript
// Use LangGraph's built-in retry config
const runtimeValidationWithRetry = runtimeValidationNode.withRetry({
  maxAttempts: 3,
  retryOn: (error) => error.message !== "Validation timeout",
});

graph
  .addNode("runtimeValidation", runtimeValidationWithRetry)
  .addConditionalEdges("runtimeValidation", (state) => {
    if (state.validationPassed) {
      return "deployWebsite";
    }
    // Validation failed - route to fix node
    return "fixWithCodingAgent";
  })
  .addEdge("fixWithCodingAgent", "runtimeValidation");  // Loop back after fix
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

### Prerequisites (Do First)

| Action | File                                                              |
| ------ | ----------------------------------------------------------------- |
| Modify | `langgraph_app/app/services/editor/core/websiteRunner.ts` (port 0) |
| Create | `langgraph_app/app/services/editor/errors/browserPool.ts`          |
| Modify | `langgraph_app/app/services/editor/errors/browserErrorCapture.ts`  |

### Runtime Validation Node

| Action | File                                                       |
| ------ | ---------------------------------------------------------- |
| Create | `langgraph_app/app/nodes/deploy/runtimeValidationNode.ts`  |
| Modify | `langgraph_app/app/graphs/deploy.ts` (add node + routing)  |
| Modify | `langgraph_app/app/annotation/deployAnnotation.ts` (add fields) |

**Note:** `fixWithCodingAgentNode` is part of the deployGraph infrastructure, not this plan.

---

## Verification

### Prerequisites

1. **Port allocation:** Run two `WebsiteRunner` instances simultaneously → both start on different ports
2. **Browser pool:** Run two validations simultaneously → only one browser process, two contexts
3. **Context cleanup:** After validation completes → context released, browser still running

### Runtime Validation Node

1. **Unit test:** Create website with console error → validation fails → `consoleErrors` populated
2. **Unit test:** Create clean website → validation passes → `validationPassed: true`
3. **Integration test:** Validation failure → fix node invoked → re-validation → success
4. **Concurrency test:** 3 simultaneous validations → all complete without port conflicts or OOM
