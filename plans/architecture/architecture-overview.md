# Architecture Overview: Landing Page Agent Infrastructure

## Core Principle

**LangGraph = Orchestrators (Smart)**

- Handle semantic understanding, decision-making, validation
- Invoke Rails jobs and wait for completion
- Retry on failure with intelligent fixes

**Rails = Workers (Dumb)**

- Execute jobs: build, upload, sync
- No decision-making, just execution
- Report success/failure back to LangGraph

---

## Two LangGraph Graphs

```
┌─────────────────────────────────────────────────────────────┐
│                   codingAgentGraph                          │
│                                                             │
│  Builds beautiful landing pages                             │
│  Tools: SearchIconsTool                                     │
│  Validation: Layer 1 (static, in-loop)                      │
│  Does NOT think about analytics/tracking                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      deployGraph                            │
│                                                             │
│  Unified deployment orchestration                           │
│  Boolean flags: deployWebsite, deployGoogleAds              │
│                                                             │
│  Nodes:                                                     │
│  ├── analyticsNode (if deployWebsite)                 │
│  ├── deployWebsiteNode (if deployWebsite)                   │
│  ├── runtimeValidationNode (if deployWebsite)               │
│  ├── fixWithCodingAgentNode (on validation failure)         │
│  └── deployCampaignNode (if deployGoogleAds)                │
└─────────────────────────────────────────────────────────────┘
```

### 1. codingAgentGraph

**Purpose:** Build beautiful landing pages

**Location:** `langgraph_app/app/graphs/codingAgent.ts`

**Responsibilities:**

- Load context (images, theme, icons, signup_token)
- Generate landing page code
- Layer 1 validation (static, in-loop)
- Does NOT think about analytics/tracking

**Tools:**

- SearchIconsTool (Lucide icon semantic search)

**Validation:**

- Layer 1: Static checks (TypeScript, links, imports)
- Retry loop with max 2 retries

---

### 2. deployGraph (UNIFIED)

**Purpose:** Orchestrate ALL deployment (website + Google Ads)

**Location:** `langgraph_app/app/graphs/deploy.ts`

**State Flags:**

```typescript
deployWebsite: boolean; // default: true
deployGoogleAds: boolean; // default: false
```

**Flow:**

```
START
    ↓
analyticsNode (if deployWebsite)
    ↓
deployWebsiteNode (if deployWebsite)
    ↓
runtimeValidationNode (if deployWebsite)
    ↓  (if errors && retryCount < 2)
    └──→ fixWithCodingAgentNode → analyticsNode
    ↓
deployCampaignNode (if deployGoogleAds)
    ↓
END
```

**Responsibilities:**

1. **analyticsNode** - Pre-deploy instrumentation (LLM semantic analysis)
   - Inject L10_CONFIG, VITE_SIGNUP_TOKEN, gtag
   - Add L10.conversion() calls to forms
2. **deployWebsiteNode** - Invoke WebsiteDeploy Rails job
3. **runtimeValidationNode** - Layer 2 validation (runtime via Playwright)
4. **fixWithCodingAgentNode** - Invoke codingAgentGraph for fix, retry
5. **deployCampaignNode** - Invoke CampaignDeploy Rails job

**Invokes:**

- `WebsiteDeploy` Rails job (build, upload)
- `CampaignDeploy` Rails job (sync to Google Ads API)
- `codingAgentGraph` for fixes

**Validation:**

- Layer 2: Runtime checks via Playwright
- Fix loop with max 2 retries

---

## Two Rails Deploy Jobs

### 1. WebsiteDeploy

**Location:** `rails_app/app/models/website_deploy.rb`

**Concerns:** `Buildable`, `Deployable`

**Does:**

- `pnpm build`
- Upload to R2
- Hotswap to live

**Reports:** Success/failure to LangGraph via callback

---

### 2. CampaignDeploy

**Location:** `rails_app/app/models/campaign_deploy.rb`

**Steps:**

- sync_budget
- create_campaign
- create_geo_targeting
- create_schedule
- create_ad_groups
- create_keywords
- create_ads

**Reports:** Success/failure to LangGraph via callback

---

## End-to-End Flow

```
User Request
    ↓
┌─────────────────────────────────────────────────────────────┐
│                      BUILD CONTEXT                          │
│                                                             │
│  ✓ Load images (multimodal)         [image-access plan]     │
│  ✓ Load theme → apply to index.css  [theme plan]            │
│  ✓ Fetch signup_token → write .env  [email-backend plan]    │
│  ✓ Load icons tool                  [icon-search plan]      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 codingAgentGraph                            │
│                                                             │
│  Focuses on beautiful landing pages                         │
│  Tools: SearchIconsTool                                     │
│  Does NOT think about analytics/tracking                    │
│  Layer 1 validation (static, in-loop, max 2 retries)        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      deployGraph                            │
│            (deployWebsite: true, deployGoogleAds: ?)        │
│                                                             │
│  1. analyticsNode                                     │
│     - Inject L10_CONFIG, VITE_SIGNUP_TOKEN, gtag            │
│     - Add L10.conversion() to forms                         │
│  2. deployWebsiteNode                                       │
│     - pnpm build, upload to R2                              │
│  3. runtimeValidationNode                                   │
│     - If errors → fixWithCodingAgentNode → retry            │
│     - Max 2 retries                                         │
│  4. deployCampaignNode (if deployGoogleAds)                 │
│     - Sync to Google Ads API                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Landing Page Live!
```

---

## Graph-to-Graph Communication

When `deployGraph` needs to fix errors, it invokes `codingAgentGraph`:

```
deployGraph
    ↓
runtimeValidationNode fails (console errors)
    ↓
fixWithCodingAgentNode invokes codingAgentGraph with error context
    ↓
codingAgentGraph fixes the code
    ↓
deployGraph retries from analyticsNode
```

This pattern follows the principle: **LangGraph orchestrates, Rails executes.**

---

## Related Plans

- `coding-agent-image-access.md` - Multimodal image injection
- `coding-agent-static-validation.md` - Layer 1 validation
- `coding-agent-deploy-validation.md` - Layer 2 validation (runtime)
- `icon-search.md` - Lucide icon semantic search
- `theme-integration.md` - Theme CSS application
- `analytics-tracking.md` - Google Ads conversion tracking (L10.conversion)
- `email-backend.md` - Lead capture infrastructure
- `deploy-graph.md` - deployGraph implementation
