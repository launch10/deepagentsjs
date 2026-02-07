# Plan: Analytics Tracking Infrastructure

## Problem

Landing pages need Google Ads conversion tracking for ROAS measurement. Currently:

- Agent hardcodes `posthog.capture()` calls (unnecessary distraction)
- No Google Ads conversion tracking
- Agent distracted by analytics instead of focusing on beautiful pages

## Key Insight: Keep It Simple

**PostHog is out of scope for now.** Reasons:

- Would require giving users our API key (they'd see our data)
- Or each user needs their own PostHog account (friction)
- Or proxy through backend (complex)

**Focus on Google Ads conversions only** - users bring their own Google Ads account, no API key sharing issues.

## Design Decisions (from discussion)

- **Semantic defaults** for conversion labels (signup, purchase, lead)
- **Every deploy** runs instrumentation
- **Google Ads only** for now (Meta later)

---

## System Context (From Exploration)

### Current Architecture

**Coding Agent** (`codingAgent.ts`):

- Uses `WebsiteFilesBackend` to read/write files
- Files persisted to Rails via `WebsiteFilesAPIService`
- Flow: buildContext → codingAgent → cleanup

**Launch Graph** (`launch.ts`):

- Currently ONLY has `deployCampaignNode` (deploys to Google Ads)
- Uses fire-and-forget + webhook callback pattern
- Needs expansion for website deploy + analytics instrumentation

**Key Files**:

- `langgraph_app/app/graphs/launch.ts` - Launch graph
- `langgraph_app/app/nodes/launch/deployCampaignNode.ts` - Campaign deploy node
- `langgraph_app/app/services/backends/websiteFilesBackend.ts` - File backend

### Key Models

- `AdsAccount.google_customer_id` - Google Ads customer ID (platform_settings JSONB)
- `Campaign.google_customer_id` - delegates to account
- `Website.campaigns` - links website to campaigns

### Template Structure

```
rails_app/templates/default/src/lib/
└── utils.ts    # Currently only cn() helper - tracking.ts goes here
```

---

## Solution Architecture

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      CODING AGENT                           │
│  Focuses on beautiful landing pages                         │
│  Does NOT think about analytics/tracking                    │
│  Uses WebsiteFilesBackend → Rails API                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      deployGraph                            │
│  (All intelligence in Langgraph)                            │
│  Boolean flags: deployWebsite, deployGoogleAds              │
│                                                             │
│  1. analyticsNode (if deployWebsite)                  │
│     └─ Add L10.conversion() to signup forms                 │
│     └─ Uses WebsiteFilesBackend to edit files               │
│                                                             │
│  2. deployWebsiteNode (if deployWebsite)                    │
│     └─ Fire-and-forget to Rails: build + upload to R2       │
│                                                             │
│  3. runtimeValidationNode (if deployWebsite)                │
│     └─ Playwright-based validation                          │
│                                                             │
│  4. deployCampaignNode (if deployGoogleAds)                 │
│     └─ Fire-and-forget to Rails: sync to Google Ads         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   RAILS (Build + Deploy)                    │
│  WebsiteDeploy: pnpm build → upload to R2                   │
│  CampaignDeploy: sync to Google Ads API                     │
│  (No tracking injection - files already have it)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     ATLAS WORKER                            │
│  Serves static files from R2 (no modification)              │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. L10.conversion() Module (Template)

**File:** `rails_app/templates/default/src/lib/tracking.ts`

```typescript
interface ConversionConfig {
  googleAdsId?: string;
}

interface ConversionProperties {
  label: string; // Google Ads conversion label
  value?: number; // Conversion value for ROAS
  currency?: string; // Default: USD
}

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    L10: typeof L10;
    L10_CONFIG?: ConversionConfig;
  }
}

export const L10 = {
  _config: {} as ConversionConfig,

  init(config?: ConversionConfig) {
    this._config = { ...window.L10_CONFIG, ...config };
  },

  conversion(properties: ConversionProperties) {
    if (window.gtag && this._config.googleAdsId) {
      window.gtag("event", "conversion", {
        send_to: `${this._config.googleAdsId}/${properties.label}`,
        value: properties.value,
        currency: properties.currency || "USD",
      });
    }
    if (import.meta.env.DEV) {
      console.log("[L10.conversion]", properties);
    }
  },
};

if (typeof window !== "undefined") {
  window.L10 = L10;
  if (window.L10_CONFIG) L10.init();
}
```

### 2. Deploy Graph (Unified)

**File:** `langgraph_app/app/graphs/deploy.ts`

```typescript
export const deployGraph = new StateGraph(DeployAnnotation)
  // Instrument tracking before deploy (if deployWebsite)
  .addNode("instrumentation", analyticsNode)

  // Deploy website to R2 (if deployWebsite)
  .addNode("deployWebsite", deployWebsiteNode)

  // Runtime validation (if deployWebsite)
  .addNode("runtimeValidation", runtimeValidationNode)

  // Fix loop (if validation fails)
  .addNode("fixWithCodingAgent", fixWithCodingAgentNode)

  // Deploy campaign to Google Ads (if deployGoogleAds)
  .addNode("deployCampaign", deployCampaignNode)

  .addEdge(START, "instrumentation")
  .addEdge("instrumentation", "deployWebsite")
  .addEdge("deployWebsite", "runtimeValidation")
  .addConditionalEdges("runtimeValidation", (state) => {
    if (state.validationPassed) {
      return state.deployGoogleAds ? "deployCampaign" : END;
    }
    if (state.retryCount >= 2) {
      return state.deployGoogleAds ? "deployCampaign" : END;
    }
    return "fixWithCodingAgent";
  })
  .addEdge("fixWithCodingAgent", "instrumentation")
  .addEdge("deployCampaign", END);
```

### 3. analyticsNode

**File:** `langgraph_app/app/nodes/deploy/analyticsNode.ts`

This node uses an LLM agent with `WebsiteFilesBackend` to:

1. Read the website's form components
2. Identify the primary conversion form (signup, waitlist, purchase)
3. Add `L10.conversion()` call on successful submission
4. Inject gtag.js snippet into index.html with the campaign's Google Ads ID

**System Prompt:**

```
You are a pre-deployment agent. Your job is to add Google Ads conversion tracking.

Tasks:
1. Find the primary conversion form (signup, waitlist, purchase, lead capture)
2. Add L10.conversion({ label: 'signup' }) on successful form submission
3. Add gtag.js script to index.html with the provided Google Ads ID

Rules:
- Only instrument ONE primary conversion per page
- Use semantic labels: "signup", "waitlist", "purchase", "lead"
- Do NOT add tracking to non-conversion interactions (nav clicks, etc.)

Example instrumentation:
const handleSubmit = async (e) => {
  e.preventDefault();
  const result = await submitForm(data);
  if (result.success) {
    L10.conversion({ label: 'signup' });
  }
};
```

### 4. deployWebsiteNode

**File:** `langgraph_app/app/nodes/deploy/deployWebsiteNode.ts`

Same pattern as `deployCampaignNode` - fire-and-forget to Rails:

```typescript
const jobRun = await jobRunApi.create({
  jobClass: "WebsiteDeploy",
  arguments: { website_id: state.websiteId },
  threadId: state.threadId,
  callbackUrl,
});
```

### 5. DeployAnnotation

**File:** `langgraph_app/app/annotation/deployAnnotation.ts`

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

  // Validation state
  validationPassed: Annotation<boolean>({
    default: () => false,
    reducer: (current, next) => next,
  }),
  validationErrors: Annotation<ValidationError[]>({
    default: () => [],
    reducer: (current, next) => next,
  }),
  retryCount: Annotation<number>({
    default: () => 0,
    reducer: (current, next) => next ?? current + 1,
  }),
});
```

---

## Files to Create/Modify

### Template

| File                                              | Change                                         |
| ------------------------------------------------- | ---------------------------------------------- |
| `rails_app/templates/default/src/lib/tracking.ts` | NEW: L10.conversion() module with label lookup |

### Langgraph (Deploy Graph)

| File                                                       | Change                                      |
| ---------------------------------------------------------- | ------------------------------------------- |
| `langgraph_app/app/graphs/deploy.ts`                       | NEW: Unified deploy graph                   |
| `langgraph_app/app/nodes/deploy/analyticsNode.ts`          | NEW: LLM agent for tracking instrumentation |
| `langgraph_app/app/nodes/deploy/deployWebsiteNode.ts`      | NEW: Fire-and-forget website deploy         |
| `langgraph_app/app/nodes/deploy/runtimeValidationNode.ts`  | NEW: Playwright-based validation            |
| `langgraph_app/app/nodes/deploy/fixWithCodingAgentNode.ts` | NEW: Invoke codingAgentGraph for fixes      |
| `langgraph_app/app/nodes/deploy/deployCampaignNode.ts`     | MOVE: From launch/ to deploy/               |
| `langgraph_app/app/nodes/deploy/index.ts`                  | NEW: Export all nodes                       |
| `langgraph_app/app/annotation/deployAnnotation.ts`         | NEW: Deploy graph state                     |
| `langgraph_app/app/graphs/launch.ts`                       | DELETE: Replaced by deploy.ts               |

### Rails (Google Ads Integration)

| File                                                                          | Change                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------- |
| `rails_app/app/services/google_ads/resources/conversion_action.rb`            | NEW: Create/manage conversion actions             |
| `rails_app/app/models/concerns/campaign_concerns/google_platform_settings.rb` | MODIFY: Add conversion_labels accessor            |
| `rails_app/app/workers/campaign_deploy/create_conversion_actions_worker.rb`   | NEW: Create standard conversion actions on deploy |

### Coding Agent

| File                       | Change                                  |
| -------------------------- | --------------------------------------- |
| Coding agent system prompt | REMOVE: analytics/tracking instructions |

---

## Event Types & Tracking Strategy

### What gtag.js Handles Automatically

When we inject `gtag('config', 'AW-xxx')`:

- **Page views** - Automatic on page load
- **Session data** - Duration, bounce rate
- **Traffic source** - UTM params, referrer

### What Needs L10.conversion() (Manual)

| Event Type   | Label      | When to Fire            | Example                           |
| ------------ | ---------- | ----------------------- | --------------------------------- |
| **Signup**   | `signup`   | Form submission success | Email waitlist, create account    |
| **Lead**     | `lead`     | Contact form submission | "Get in touch", "Request demo"    |
| **Purchase** | `purchase` | Payment confirmation    | Checkout complete (if applicable) |
| **Download** | `download` | Resource download click | PDF, ebook, whitepaper            |

### What We DON'T Track (Not Conversions)

- Navigation clicks
- Scroll depth
- Time on page
- Video plays (unless that IS the conversion)
- Social shares

### Conversion Value

For ROAS calculation, some conversions can include value:

```typescript
// Signup with no monetary value
L10.conversion({ label: "signup" });

// Lead with estimated value
L10.conversion({ label: "lead", value: 50, currency: "USD" });

// Purchase with actual value
L10.conversion({ label: "purchase", value: 99.99, currency: "USD" });
```

### Google Ads Conversion Action Setup

**Approach**: Auto-create conversion actions in Google Ads via API

When a campaign is deployed:

1. We create conversion actions in Google Ads with our semantic names
2. Google returns conversion labels for each action
3. We store the label mapping in the Campaign model
4. L10.conversion() uses the stored label

**Conversion Actions to Create:**
| Our Label | Google Ads Name | Category |
|-----------|-----------------|----------|
| `signup` | "Waitlist Signup" | SUBMIT_LEAD_FORM |
| `lead` | "Lead Capture" | SUBMIT_LEAD_FORM |
| `purchase` | "Purchase" | PURCHASE |
| `download` | "Resource Download" | OTHER |

**Implementation:**

```ruby
# In CampaignDeploy job or GoogleAds::Resources::ConversionAction
class GoogleAds::Resources::ConversionAction
  SEMANTIC_ACTIONS = {
    signup: { name: "Waitlist Signup", category: "SUBMIT_LEAD_FORM" },
    lead: { name: "Lead Capture", category: "SUBMIT_LEAD_FORM" },
    purchase: { name: "Purchase", category: "PURCHASE" },
    download: { name: "Resource Download", category: "OTHER" }
  }

  def create_standard_actions
    SEMANTIC_ACTIONS.each do |semantic_label, config|
      action = create_conversion_action(config)
      campaign.update_conversion_label(semantic_label, action.tag_snippets.conversion_label)
    end
  end
end
```

**Campaign Model Addition:**

```ruby
# Add to Campaign model
store_accessor :platform_settings, :conversion_labels
# conversion_labels = { "signup" => "abc123", "lead" => "def456" }
```

**Injected Config (by instrumentTrackingNode):**

```html
<!-- In index.html -->
<script>
  window.L10_CONFIG = {
    googleAdsId: "AW-123456789",
    conversionLabels: {
      signup: "abc123",
      lead: "def456",
    },
  };
</script>
```

**L10.conversion() Flow:**

```
L10.conversion({ label: 'signup' })
    ↓
Lookup: window.L10_CONFIG.conversionLabels['signup'] → "abc123"
    ↓
gtag('event', 'conversion', { send_to: 'AW-123456789/abc123' })
```

**Updated tracking.ts:**

```typescript
interface ConversionConfig {
  googleAdsId?: string;
  conversionLabels?: Record<string, string>;
}

conversion(properties: ConversionProperties) {
  const label = this._config.conversionLabels?.[properties.label] || properties.label;
  if (window.gtag && this._config.googleAdsId) {
    window.gtag('event', 'conversion', {
      send_to: `${this._config.googleAdsId}/${label}`,
      value: properties.value,
      currency: properties.currency || 'USD',
    });
  }
}
```

---

## Key Decisions

1. **All intelligence in Langgraph** - Rails only builds/deploys, no tracking injection
2. **Unified deployGraph** - Single graph with `deployWebsite` and `deployGoogleAds` boolean flags
3. **analyticsNode** uses LLM agent with WebsiteFilesBackend to edit files
4. **gtag.js injected by Langgraph** into index.html (not Rails build phase)
5. **Semantic labels** - "signup", "purchase", "lead" based on form context
6. **Every deploy** runs instrumentation (keeps tracking up-to-date with page changes)
7. **Form submissions only** - We only track actual conversions, not general interactions
8. **No PostHog** - Only Google Ads conversion tracking via L10.conversion()

---

## Verification Plan

1. **Template Test**: Create test website, verify `L10` is available in dev console
2. **Instrumentation Test**: Run deployGraph with `deployWebsite: true`, verify:
   - Form has `L10.conversion()` call added
   - `index.html` has gtag.js script with correct Google Ads ID
3. **Validation Test**: Introduce console error, verify runtimeValidationNode catches it
4. **E2E Test**: Fill form → verify conversion event fires in Network tab
5. **Google Ads Test**: Use test campaign with `deployGoogleAds: true`, verify conversion appears in dashboard
