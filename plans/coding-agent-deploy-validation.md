# Plan: Pre-Deployment Runtime Validation (Layer 2)

## Summary

Runtime validation that runs as part of `deployGraph` before website goes live. This catches issues that static analysis misses by actually running the site in a browser.

**Integration Point:** `runtimeValidationNode` in `deployGraph`

## Dependencies

- **`plans/coding-agent-static-validation.md`** - Layer 1 static checks should pass first
- **`plans/atlas-spa-fallback.md`** - Atlas SPA fallback for route testing
- **`plans/website-deploy-graph.md`** - deployGraph that orchestrates this validation

## Architecture Context

Per `architecture-overview.md`:
- **LangGraph orchestrates** - `deployGraph` runs validation, decides on retries
- **Rails executes** - Just builds and uploads, no validation logic

```
deployGraph
├── instrumentationNode     # Inject tracking
├── deployWebsiteNode       # Build + upload to R2
├── runtimeValidationNode   # <-- THIS PLAN
├── fixWithCodingAgentNode  # Fix errors via codingAgentGraph
└── deployCampaignNode      # Google Ads (if enabled)
```

---

## Current State

**Existing infrastructure to reuse:**
- `BrowserErrorCapture` - Playwright-based console error capture
- `ErrorExporter` - Orchestrates FileExporter → WebsiteRunner → BrowserErrorCapture
- `WebsiteRunner` - Runs dev servers in isolation
- `FileExporter` - Exports files to /tmp for validation

---

## Validation Checks

### 1. All Static Checks (Layer 1)

Run the same link and build validation from `coding-agent-static-validation.md`.

### 2. Runtime Validation

Using existing `ErrorExporter` + `WebsiteRunner` + `BrowserErrorCapture`:

| Check | How |
|-------|-----|
| Page loads | Navigate to `/`, verify no crash |
| No console errors | Capture `console.error` calls |
| No failed network requests | Monitor 4xx/5xx responses |
| Routes work | Navigate to each defined route |
| Assets load | Verify images/JS/CSS return 200 |

### 3. Future Checks (Not in Scope)

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
import { ErrorExporter } from "@services/editor/errorExporter";
import { WebsiteFilesBackend } from "@services/backends/websiteFilesBackend";

export interface RuntimeError {
  type: 'console' | 'network' | 'render';
  message: string;
  url?: string;
  route?: string;
}

export const runtimeValidationNode = async (
  state: typeof DeployAnnotation.State
): Promise<Partial<typeof DeployAnnotation.State>> => {
  const filesBackend = new WebsiteFilesBackend(state.websiteId, state.jwt);
  const files = await filesBackend.listFiles();

  const errorExporter = new ErrorExporter();
  const errors: RuntimeError[] = [];

  // 1. Export files and run dev server
  const exportResult = await errorExporter.export(files);

  // 2. Check for console errors
  for (const consoleError of exportResult.consoleErrors) {
    errors.push({
      type: 'console',
      message: consoleError.message,
      url: consoleError.url,
    });
  }

  // 3. Check for failed network requests
  for (const failedRequest of exportResult.failedRequests) {
    errors.push({
      type: 'network',
      message: `Failed to load: ${failedRequest.url} (${failedRequest.status})`,
      url: failedRequest.url,
    });
  }

  // 4. Check each route renders
  const routes = extractRoutes(files);
  for (const route of routes) {
    const routeResult = await errorExporter.checkRoute(route);
    if (!routeResult.success) {
      errors.push({
        type: 'render',
        message: `Route failed to render: ${route}`,
        route,
      });
    }
  }

  return {
    validationPassed: errors.length === 0,
    validationErrors: errors,
  };
};

function extractRoutes(files: CodeFile[]): string[] {
  const appFile = files.find(f => f.path.endsWith('App.tsx'));
  if (!appFile) return ['/'];

  const routes: string[] = ['/'];
  const routeMatches = appFile.content.matchAll(/<Route\s+path=["']([^"']+)["']/g);

  for (const match of routeMatches) {
    const path = match[1];
    if (path !== '*' && path !== '/') {
      routes.push(path);
    }
  }

  return routes;
}
```

### Fix Loop Integration

When validation fails, `deployGraph` routes to `fixWithCodingAgentNode`:

**File:** `langgraph_app/app/nodes/deploy/fixWithCodingAgentNode.ts`

```typescript
import { DeployAnnotation } from "@annotation";
import { codingAgentGraph } from "@graphs/codingAgent";

export const fixWithCodingAgentNode = async (
  state: typeof DeployAnnotation.State
): Promise<Partial<typeof DeployAnnotation.State>> => {
  // Format errors for coding agent
  const errorContext = state.validationErrors
    .map(e => `- ${e.type}: ${e.message}`)
    .join('\n');

  // Invoke codingAgentGraph with error context
  await codingAgentGraph.invoke({
    ...state,
    messages: [
      ...state.messages,
      {
        role: 'system',
        content: `Runtime validation failed. Fix these errors:\n\n${errorContext}`,
      },
    ],
  });

  return {
    retryCount: state.retryCount + 1,
    validationPassed: false,
    validationErrors: [],
  };
};
```

### Graph Routing

**File:** `langgraph_app/app/graphs/deploy.ts` (excerpt)

```typescript
.addConditionalEdges("runtimeValidation", (state) => {
  if (state.validationPassed) {
    return state.deployGoogleAds ? "deployCampaign" : END;
  }
  if (state.retryCount >= 2) {
    // Max retries reached, proceed anyway or fail
    return state.deployGoogleAds ? "deployCampaign" : END;
  }
  return "fixWithCodingAgent"; // Trigger fix loop
})
```

---

## Error Display

When validation fails after max retries, show the user actionable errors in the UI:

```
## Deploy Blocked

Your site has issues that need to be fixed before deploying:

### Runtime Errors

- Console error on /pricing: "TypeError: Cannot read property 'map' of undefined"
- Failed to load: /images/hero.png (404)
- Route /about failed to render

### How to Fix

1. Check the Pricing page for JavaScript errors
2. Ensure hero.png exists in public/images/
3. Verify the About page component exports correctly

[Fix Issues] [Deploy Anyway (not recommended)]
```

---

## Files Summary

| Action | File |
|--------|------|
| Create | `langgraph_app/app/nodes/deploy/runtimeValidationNode.ts` |
| Create | `langgraph_app/app/nodes/deploy/fixWithCodingAgentNode.ts` |
| Modify | `langgraph_app/app/graphs/deploy.ts` (add conditional edges) |
| Modify | Deploy UI to show validation errors |

---

## Rollout

1. **Phase 1**: Add validation node, attempt fix loop, proceed on failure
2. **Phase 2**: Show warnings to users when validation fails after retries
3. **Phase 3**: Option to block deploys on validation failure
