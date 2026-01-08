# Plan: deployGraph (Unified)

## Summary

Unified LangGraph graph that orchestrates ALL deployment: website deployment to Cloudflare AND Google Ads campaign deployment. Uses boolean flags to control which deployments to execute.

**Replaces:** Both `websiteDeployGraph` (proposed) and `launchGraph` (existing)

## Architecture Context

See `architecture-overview.md` for the full system architecture.

**Key principle:** LangGraph orchestrates (smart), Rails executes (dumb).

---

## Graph Structure

```
deployGraph
├── instrumentationNode     # LLM semantic analysis + deterministic inject (if deployWebsite)
├── deployWebsiteNode       # Invoke WebsiteDeploy Rails job (if deployWebsite)
├── runtimeValidationNode   # Layer 2 validation via Playwright (if deployWebsite)
├── fixWithCodingAgentNode  # Invoke codingAgentGraph on error
└── deployCampaignNode      # Invoke CampaignDeploy Rails job (if deployGoogleAds)
```

### Flow

```
START
    ↓
instrumentationNode (if deployWebsite)
    ↓
deployWebsiteNode (if deployWebsite)
    ↓
runtimeValidationNode (if deployWebsite)
    ↓  (if errors && retryCount < 2)
    └──→ fixWithCodingAgentNode → instrumentationNode
    ↓  (if pass || retryCount >= 2)
deployCampaignNode (if deployGoogleAds)
    ↓
END
```

### Boolean Flags

```typescript
deployWebsite: boolean    // default: true - deploy website to Cloudflare
deployGoogleAds: boolean  // default: false - deploy campaign to Google Ads
```

---

## Node Definitions

### 1. instrumentationNode

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

**Outputs:**
- `instrumentationComplete: true`
- `instrumentedFiles: string[]` - List of modified files

---

### 2. deployWebsiteNode

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

**Outputs:**
- `deployStatus: "pending" | "completed" | "failed"`
- `deployResult: { version_path, url, ... }`

---

### 3. runtimeValidationNode

**Purpose:** Layer 2 validation using Playwright

**Inputs:**
- `websiteId` - Website to validate
- `deployResult` - Contains URL to test

**Process:**
1. Use existing `WebsiteRunner` to start dev server
2. Use existing `BrowserErrorCapture` to load page in Playwright
3. Capture console errors, warnings, failed requests
4. Check for visual rendering issues

**Outputs:**
- `validationPassed: boolean`
- `validationErrors: ValidationError[]`

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

  // IDs
  websiteId: Annotation<PrimaryKeyType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),
  campaignId: Annotation<PrimaryKeyType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),
  googleAdsId: Annotation<string | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  // Instrumentation tracking
  instrumentationComplete: Annotation<boolean>({
    default: () => false,
    reducer: (current, next) => next,
  }),
  instrumentedFiles: Annotation<string[]>({
    default: () => [],
    reducer: (current, next) => next,
  }),

  // Deploy status
  websiteDeployStatus: Annotation<"pending" | "completed" | "failed" | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),
  websiteDeployResult: Annotation<Record<string, unknown> | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),
  campaignDeployStatus: Annotation<"pending" | "completed" | "failed" | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  // Validation
  validationPassed: Annotation<boolean>({
    default: () => false,
    reducer: (current, next) => next,
  }),
  validationErrors: Annotation<ValidationError[]>({
    default: () => [],
    reducer: (current, next) => next,
  }),

  // Retry tracking
  retryCount: Annotation<number>({
    default: () => 0,
    reducer: (current, next) => next ?? current + 1,
  }),

  // Task tracking for idempotency
  tasks: Annotation<ChecklistTask[]>({
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

---

## Graph Definition

```typescript
import { StateGraph, END, START } from "@langchain/langgraph";
import { DeployAnnotation } from "@annotation";
import {
  instrumentationNode,
  deployWebsiteNode,
  runtimeValidationNode,
  fixWithCodingAgentNode,
  deployCampaignNode,
} from "@nodes";

export const deployGraph = new StateGraph(DeployAnnotation)
  .addNode("instrumentation", instrumentationNode)
  .addNode("deployWebsite", deployWebsiteNode)
  .addNode("runtimeValidation", runtimeValidationNode)
  .addNode("fixWithCodingAgent", fixWithCodingAgentNode)
  .addNode("deployCampaign", deployCampaignNode)

  // Start: go to instrumentation if deployWebsite, else deployCampaign or END
  .addConditionalEdges(START, (state) => {
    if (state.deployWebsite) return "instrumentation";
    if (state.deployGoogleAds) return "deployCampaign";
    return END;
  })

  // Website deploy flow
  .addEdge("instrumentation", "deployWebsite")
  .addEdge("deployWebsite", "runtimeValidation")

  // Validation routing
  .addConditionalEdges("runtimeValidation", (state) => {
    if (state.validationPassed) {
      return state.deployGoogleAds ? "deployCampaign" : END;
    }
    if (state.retryCount >= 2) {
      // Max retries reached, proceed to campaign deploy or end
      return state.deployGoogleAds ? "deployCampaign" : END;
    }
    return "fixWithCodingAgent"; // Trigger fix loop
  })

  // Fix loop back to instrumentation
  .addEdge("fixWithCodingAgent", "instrumentation")

  // Campaign deploy to END
  .addEdge("deployCampaign", END);
```

---

## Fix Loop Integration

When validation fails, invoke `codingAgentGraph` to fix:

```typescript
const fixWithCodingAgentNode = async (state) => {
  // Format errors for coding agent
  const errorContext = formatValidationErrors(state.validationErrors);

  // Invoke codingAgentGraph with error context
  // (Implementation TBD - may use subgraph or API call)

  return {
    retryCount: state.retryCount + 1,
  };
};
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `langgraph_app/app/graphs/deploy.ts` | CREATE | Unified deploy graph definition |
| `langgraph_app/app/annotation/deployAnnotation.ts` | CREATE | State annotation with boolean flags |
| `langgraph_app/app/nodes/deploy/instrumentationNode.ts` | CREATE | LLM + deterministic inject |
| `langgraph_app/app/nodes/deploy/deployWebsiteNode.ts` | CREATE | Invoke WebsiteDeploy Rails job |
| `langgraph_app/app/nodes/deploy/runtimeValidationNode.ts` | CREATE | Playwright validation |
| `langgraph_app/app/nodes/deploy/fixWithCodingAgentNode.ts` | CREATE | Invoke codingAgentGraph |
| `langgraph_app/app/nodes/deploy/deployCampaignNode.ts` | MOVE | From launch/ to deploy/ |
| `langgraph_app/app/nodes/deploy/index.ts` | CREATE | Export all nodes |
| `langgraph_app/app/graphs/launch.ts` | DELETE | Replaced by deploy.ts |
| `langgraph_app/app/nodes/launch/` | DELETE | Replaced by deploy/ |

---

## Dependencies

**Existing infrastructure to reuse:**
- `WebsiteRunner` - Dev server for validation
- `BrowserErrorCapture` - Playwright console capture
- `ErrorExporter` - Orchestrates validation
- `WebsiteDeploy` Rails job - Build and upload
- `JobRunAPIService` - Invoke Rails jobs

**New services needed:**
- `InstrumentationService` - LLM semantic analysis + deterministic inject

---

## Verification

1. **Unit tests:** Each node in isolation
2. **Integration test:** Full graph flow with mock Rails jobs
3. **E2E test - Website only:**
   - Invoke deployGraph with `{ deployWebsite: true, deployGoogleAds: false }`
   - Verify instrumentation added
   - Verify page deployed to R2
   - Verify validation passes
4. **E2E test - Full deploy:**
   - Invoke deployGraph with `{ deployWebsite: true, deployGoogleAds: true }`
   - Verify website deployed
   - Verify campaign deployed to Google Ads
5. **E2E test - Campaign only:**
   - Invoke deployGraph with `{ deployWebsite: false, deployGoogleAds: true }`
   - Verify skips website deploy
   - Verify campaign deployed to Google Ads
