# Plan: deployGraph (Unified)

## Summary

Unified LangGraph graph that orchestrates ALL deployment: website deployment to Cloudflare AND Google Ads campaign deployment. Uses boolean flags to control which deployments to execute.

**Replaces:** Both `websiteDeployGraph` (proposed) and `launchGraph` (existing)

## Architecture Context

See `architecture-overview.md` for the full system architecture.

**Key principle:** LangGraph orchestrates (smart), Rails executes (dumb).

---

## Task-Based State Pattern

All deploy operations use the unified `Task` interface for state tracking:

```typescript
interface Task {
  name: string; // e.g., "instrumentation", "website_deploy"
  status: "pending" | "running" | "completed" | "failed";
  result?: Record<string, unknown>; // Node-specific output
  error?: string; // Error message on failure
}
```

**Benefits:**

- Single `tasks[]` array instead of per-operation status fields
- Frontend displays progress via Tasks[] API
- Partial failures are visible (e.g., website_deploy: completed, campaign_deploy: failed)
- Consistent pattern across all graphs

**Task Names:**
| Task Name | Node | Description |
|-----------|------|-------------|
| `instrumentation` | analyticsNode | LLM analysis + tracking injection |
| `website_deploy` | deployWebsiteNode | Build + upload to Cloudflare |
| `runtime_validation` | runtimeValidationNode | Playwright console/network checks |
| `code_fix` | fixWithCodingAgentNode | Invoke codingAgentGraph to fix errors |
| `campaign_deploy` | deployCampaignNode | Sync to Google Ads API |

---

## Graph Structure

```
deployGraph
├── analyticsNode     # LLM semantic analysis + deterministic inject (if deployWebsite)
├── deployWebsiteNode       # Invoke WebsiteDeploy Rails job (if deployWebsite)
├── runtimeValidationNode   # Layer 2 validation via Playwright (if deployWebsite)
├── fixWithCodingAgentNode  # Invoke codingAgentGraph subgraph on error
└── deployCampaignNode      # Invoke CampaignDeploy Rails job (if deployGoogleAds)
```

### Flow

```
START
    ↓
    ├── (if !deployWebsite && !deployGoogleAds) → END (no-op)
    ↓
analyticsNode (if deployWebsite)
    ↓
deployWebsiteNode (if deployWebsite)
    ↓
runtimeValidationNode (if deployWebsite)
    ↓  (if errors && retryCount < 2)
    └──→ fixWithCodingAgentNode → analyticsNode
    ↓  (if pass || retryCount >= 2)
deployCampaignNode (if deployGoogleAds)
    ↓
END
```

### Boolean Flags

```typescript
deployWebsite: boolean; // default: true - deploy website to Cloudflare
deployGoogleAds: boolean; // default: false - deploy campaign to Google Ads
```

**Edge case:** If both flags are `false`, the graph exits immediately at START. This is a valid no-op (e.g., caller changed their mind).

---

## Node Definitions

### 1. analyticsNode

**Task:** `instrumentation`

**Purpose:** Pre-deploy instrumentation using hybrid LLM + deterministic approach

**Inputs:**

- `websiteId` - Website to deploy
- `jwt` - Authentication token

**Process:**

1. **LLM semantic analysis:** Analyze page content to determine:
   - Is there a pricing page? → Add conversion tracking
   - Is there a signup form? → Add waitlist tracking
   - What is the primary CTA?

2. **Deterministic injection:**
   - Inject `L10_CONFIG` with `google_ads_id` from Campaign
   - Inject `VITE_SIGNUP_TOKEN` from Project
   - Add gtag script if campaign has Google Ads
   - Call `L10.init()` in main.tsx

**Task Output:**

```typescript
{
  name: "instrumentation",
  status: "completed",
  result: {
    instrumentedFiles: ["src/main.tsx", "index.html"],
    conversionsAdded: ["signup_form", "pricing_cta"]
  }
}
```

---

### 2. deployWebsiteNode

**Task:** `website_deploy`

**Purpose:** Invoke WebsiteDeploy Rails job and wait for completion

**Pattern:** Fire-and-forget + idempotent (same as `deployCampaignNode`)

**Inputs:**

- `websiteId` - Website to deploy
- `jwt` - Authentication token
- `threadId` - For callback

**Process:**

1. Create task with "pending" status
2. Call Rails API to create WebsiteDeploy job
3. Return and wait for webhook callback
4. On callback: update task status, return result

**Task Output:**

```typescript
{
  name: "website_deploy",
  status: "completed",
  result: {
    versionPath: "v1234",
    url: "https://example.launch10.ai",
    deployId: 567
  }
}
```

---

### 3. runtimeValidationNode

**Task:** `runtime_validation`

**Purpose:** Layer 2 validation using Playwright

**Inputs:**

- `websiteId` - Website to validate
- `tasks` - Contains website_deploy result with URL

**Process:**

1. Use existing `WebsiteRunner` to start dev server
2. Use existing `BrowserErrorCapture` to load page in Playwright
3. Capture console errors, warnings, failed requests
4. Check for visual rendering issues

**Task Output (success):**

```typescript
{
  name: "runtime_validation",
  status: "completed",
  result: { errors: [], warnings: [] }
}
```

**Task Output (failure):**

```typescript
{
  name: "runtime_validation",
  status: "failed",
  error: "Console errors detected",
  result: {
    errors: [
      { type: "console", message: "Uncaught TypeError: Cannot read property 'foo'" },
      { type: "network", message: "GET /api/missing 404" }
    ]
  }
}
```

---

### 4. fixWithCodingAgentNode

**Task:** `code_fix`

**Purpose:** Invoke codingAgentGraph as subgraph to fix runtime errors

**Subgraph Invocation:**

```typescript
import { codingAgentGraph } from "@graphs/codingAgent";

const fixWithCodingAgentNode = async (state: typeof DeployAnnotation.State) => {
  // Get validation errors from runtime_validation task
  const validationTask = state.tasks.find((t) => t.name === "runtime_validation");
  const errors = validationTask?.result?.errors ?? [];

  // Format errors for coding agent
  const errorContext = formatValidationErrors(errors);

  // Invoke codingAgentGraph as subgraph
  const result = await codingAgentGraph.invoke({
    ...state,
    messages: [new HumanMessage(`Fix the following runtime errors:\n\n${errorContext}`)],
  });

  return {
    tasks: [
      {
        name: "code_fix",
        status: "completed",
        result: { filesModified: result.modifiedFiles },
      },
    ],
    retryCount: state.retryCount + 1,
  };
};
```

**Notes:**

- `codingAgentGraph` is invoked as a subgraph (not API call)
- Shares state via `BaseAnnotation.spec`
- Increments `retryCount` to track retry attempts
- Max 2 retries before proceeding (even with errors)

---

### 5. deployCampaignNode

**Task:** `campaign_deploy`

**Purpose:** Invoke CampaignDeploy Rails job

**Pattern:** Same fire-and-forget + idempotent pattern as existing `launchGraph`

---

## State Annotation

```typescript
export const DeployAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,

  // Boolean flags for what to deploy
  deployWebsite: Annotation<boolean>({
    default: () => true,
    reducer: (current, next) => next ?? current,
  }),
  deployGoogleAds: Annotation<boolean>({
    default: () => false,
    reducer: (current, next) => next ?? current,
  }),

  // IDs (websiteId already in BaseAnnotation)
  campaignId: Annotation<PrimaryKeyType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next ?? current,
  }),
  googleAdsId: Annotation<string | undefined>({
    default: () => undefined,
    reducer: (current, next) => next ?? current,
  }),

  // Retry tracking for fix loop
  retryCount: Annotation<number>({
    default: () => 0,
    reducer: (current, next) => next, // Explicit increment only
  }),

  // Task tracking - ALL state lives here
  tasks: Annotation<Task[]>({
    default: () => [],
    reducer: (current, next) => {
      const taskMap = new Map(current.map((t) => [t.name, t]));
      for (const task of next) {
        taskMap.set(task.name, { ...taskMap.get(task.name), ...task });
      }
      return Array.from(taskMap.values());
    },
  }),
});
```

**Removed fields** (now tracked via `tasks[]`):

- ~~`instrumentationComplete`~~
- ~~`instrumentedFiles`~~
- ~~`websiteDeployStatus`~~
- ~~`websiteDeployResult`~~
- ~~`campaignDeployStatus`~~
- ~~`validationPassed`~~
- ~~`validationErrors`~~

---

## Graph Definition

```typescript
import { StateGraph, END, START } from "@langchain/langgraph";
import { DeployAnnotation } from "@annotation";
import {
  analyticsNode,
  deployWebsiteNode,
  runtimeValidationNode,
  fixWithCodingAgentNode,
  deployCampaignNode,
} from "@nodes";

// Helper to check task status
const getTaskStatus = (state: typeof DeployAnnotation.State, name: string) =>
  state.tasks.find((t) => t.name === name)?.status;

export const deployGraph = new StateGraph(DeployAnnotation)
  .addNode("instrumentation", analyticsNode)
  .addNode("deployWebsite", deployWebsiteNode)
  .addNode("runtimeValidation", runtimeValidationNode)
  .addNode("fixWithCodingAgent", fixWithCodingAgentNode)
  .addNode("deployCampaign", deployCampaignNode)

  // Start: check flags, exit early if nothing to deploy
  .addConditionalEdges(START, (state) => {
    if (!state.deployWebsite && !state.deployGoogleAds) return END; // No-op
    if (state.deployWebsite) return "instrumentation";
    return "deployCampaign";
  })

  // Website deploy flow
  .addEdge("instrumentation", "deployWebsite")
  .addEdge("deployWebsite", "runtimeValidation")

  // Validation routing
  .addConditionalEdges("runtimeValidation", (state) => {
    const validationStatus = getTaskStatus(state, "runtime_validation");

    if (validationStatus === "completed") {
      return state.deployGoogleAds ? "deployCampaign" : END;
    }
    if (state.retryCount >= 2) {
      // Max retries reached, proceed anyway (errors visible in tasks[])
      return state.deployGoogleAds ? "deployCampaign" : END;
    }
    return "fixWithCodingAgent";
  })

  // Fix loop back to instrumentation
  .addEdge("fixWithCodingAgent", "instrumentation")

  // Campaign deploy to END
  .addEdge("deployCampaign", END);
```

---

## Error Handling

**Principle:** Partial failures are surfaced via the Tasks[] API, not hidden.

**Frontend visibility:**

- Tasks[] is exposed via API endpoint
- Frontend polls/subscribes to task status
- Each task shows: pending → running → completed/failed
- Failed tasks include `error` message and `result` with details

**Examples:**

| Scenario                       | Task States                                                                    | User Experience                          |
| ------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------- |
| Full success                   | All completed                                                                  | "Deploy complete!"                       |
| Validation fails, fix succeeds | runtime_validation: failed, code_fix: completed, runtime_validation: completed | "Fixed 1 error, deployed"                |
| Validation fails after retries | runtime_validation: failed (persists)                                          | "Deployed with warnings" + error details |
| Campaign fails                 | website_deploy: completed, campaign_deploy: failed                             | "Website live, ads failed" + error       |

**No silent failures:** If a task fails, the user sees it. The graph proceeds (to avoid blocking), but the failure is recorded.

---

## Files to Create/Modify

| File                                                       | Action | Description                              |
| ---------------------------------------------------------- | ------ | ---------------------------------------- |
| `langgraph_app/app/graphs/deploy.ts`                       | CREATE | Unified deploy graph definition          |
| `langgraph_app/app/annotation/deployAnnotation.ts`         | CREATE | State annotation with Task-based pattern |
| `langgraph_app/app/nodes/deploy/analyticsNode.ts`          | CREATE | LLM + deterministic inject               |
| `langgraph_app/app/nodes/deploy/deployWebsiteNode.ts`      | CREATE | Invoke WebsiteDeploy Rails job           |
| `langgraph_app/app/nodes/deploy/runtimeValidationNode.ts`  | CREATE | Playwright validation                    |
| `langgraph_app/app/nodes/deploy/fixWithCodingAgentNode.ts` | CREATE | Invoke codingAgentGraph subgraph         |
| `langgraph_app/app/nodes/deploy/deployCampaignNode.ts`     | MOVE   | From launch/ to deploy/                  |
| `langgraph_app/app/nodes/deploy/index.ts`                  | CREATE | Export all nodes                         |
| `langgraph_app/app/graphs/launch.ts`                       | DELETE | Replaced by deploy.ts                    |
| `langgraph_app/app/nodes/launch/`                          | DELETE | Replaced by deploy/                      |

---

## Dependencies

**Existing infrastructure to reuse:**

- `WebsiteRunner` - Dev server for validation
- `BrowserErrorCapture` - Playwright console capture
- `ErrorExporter` - Orchestrates validation
- `WebsiteDeploy` Rails job - Build and upload
- `JobRunAPIService` - Invoke Rails jobs
- `codingAgentGraph` - Invoked as subgraph for fixes

**New services needed:**

- `InstrumentationService` - LLM semantic analysis + deterministic inject

---

## Verification

1. **Unit tests:** Each node in isolation
2. **Integration test:** Full graph flow with mock Rails jobs
3. **E2E test - Website only:**
   - Invoke deployGraph with `{ deployWebsite: true, deployGoogleAds: false }`
   - Verify instrumentation task completed
   - Verify website_deploy task completed
   - Verify runtime_validation task completed
4. **E2E test - Full deploy:**
   - Invoke deployGraph with `{ deployWebsite: true, deployGoogleAds: true }`
   - Verify all 5 tasks complete
5. **E2E test - Campaign only:**
   - Invoke deployGraph with `{ deployWebsite: false, deployGoogleAds: true }`
   - Verify only campaign_deploy task runs
6. **E2E test - No-op:**
   - Invoke deployGraph with `{ deployWebsite: false, deployGoogleAds: false }`
   - Verify graph exits immediately, no tasks created
7. **E2E test - Validation failure + fix:**
   - Inject runtime error
   - Verify runtime_validation fails
   - Verify code_fix task runs
   - Verify retry loop (up to 2 times)
   - Verify final state shows error history in tasks[]
