# Analytics Dashboard Insights - Strategic Design

## Decisions Made

- ✅ Include ROAS (conversion_value / cost)
- ✅ Always find a positive (never 3 negative insights)
- ✅ Data depth: Totals + Projects (~500 tokens)
- ✅ Track days_since_last_lead for stall detection
- ✅ **Actionable insights are king** - every insight should suggest what to CHANGE

---

## Most Valuable Metrics (Ranked)

### Tier 1: The North Stars (Must Include)

These answer "Is my idea working?"

| Metric                  | Why It's Critical                                      | Insight Examples                           |
| ----------------------- | ------------------------------------------------------ | ------------------------------------------ |
| **Lead Count**          | The whole point. If no leads, nothing else matters.    | "5 leads this week" / "No leads in 7 days" |
| **Lead Trend**          | Direction matters more than absolute numbers early on. | "Leads up 40% from last week"              |
| **Cost Per Lead (CPL)** | The efficiency of your spend. Can you afford to scale? | "$28/lead, down 18%"                       |

### Tier 2: Efficiency Signals (Include When Available)

These answer "Am I spending wisely?"

| Metric          | Why It Matters                                                                     | Insight Examples                     |
| --------------- | ---------------------------------------------------------------------------------- | ------------------------------------ |
| **ROAS**        | Direct ROI when tracking conversions. The ultimate efficiency metric.              | "Generating $5 for every $1 spent"   |
| **Total Spend** | Context for all other metrics. $100 and 2 leads is fine. $1000 and 2 leads is not. | "Spent $847 this month"              |
| **CTR Trend**   | Leading indicator. CTR dropping = problem coming.                                  | "CTR up 23% - ads resonating better" |

### Tier 3: Diagnostic Data (Use for Problem Detection)

These answer "Where is it breaking?"

| Metric              | What It Diagnoses               | When to Surface                                         |
| ------------------- | ------------------------------- | ------------------------------------------------------- |
| **Impressions**     | Are you reaching people at all? | When very low → targeting problem                       |
| **CTR**             | Are your ads compelling?        | When high impressions but low clicks → creative problem |
| **Page Views**      | Is traffic reaching your page?  | When clicks but low views → landing page not loading?   |
| **Conversion Rate** | Is your landing page working?   | When high traffic but no leads → page problem           |

### Tier 3: Project Comparison (Multi-Project Accounts)

These answer "Which idea is winning?"

| Metric                       | Why It Matters                  | When to Surface                      |
| ---------------------------- | ------------------------------- | ------------------------------------ |
| **Best Performing Project**  | Focus energy where it's working | When one project clearly outperforms |
| **Worst Performing Project** | Cut losses or fix problems      | When one project is burning money    |
| **Relative CPL**             | Fair comparison across projects | When comparing efficiency            |

---

## Recommended Insight Data Package

Based on the above, here's what I recommend sending to the LLM:

```json
{
  "period": "Last 30 Days",
  "account_totals": {
    "leads": 47,
    "leads_trend_percent": 23,
    "leads_trend_direction": "up",
    "page_views": 3420,
    "total_spend_dollars": 847.5,
    "ctr_percent": 4.2,
    "ctr_trend_percent": 15,
    "cpl_dollars": 18.03,
    "cpl_trend_percent": -12,
    "roas": 3.5, // NEW
    "roas_available": true // NEW
  },
  "projects": [
    {
      "name": "Premium Pet Portraits",
      "leads": 32,
      "leads_trend_percent": 45,
      "spend_dollars": 523.0,
      "cpl_dollars": 16.34,
      "ctr_percent": 5.1,
      "days_since_last_lead": 1,
      "roas": 4.2
    },
    {
      "name": "Budget Travel Guides",
      "leads": 0,
      "spend_dollars": 187.0,
      "cpl_dollars": null,
      "ctr_percent": 1.2,
      "days_since_last_lead": 14 // Stalled!
    }
  ],
  "flags": {
    "has_stalled_project": true,
    "has_high_performer": true,
    "has_new_first_lead": false
  }
}
```

This is **Totals + Trends + Project Summaries** - no daily breakdown needed for these insights.

---

## Available Data

From the backend we built:

| Metric               | Source                | Granularity           |
| -------------------- | --------------------- | --------------------- |
| **Leads**            | website_leads         | per project, per day  |
| **Page Views**       | domain_request_counts | per domain, per hour  |
| **Impressions**      | ad_performance_daily  | per campaign, per day |
| **Clicks**           | ad_performance_daily  | per campaign, per day |
| **Cost (micros)**    | ad_performance_daily  | per campaign, per day |
| **Conversions**      | ad_performance_daily  | per campaign, per day |
| **Conversion Value** | ad_performance_daily  | per campaign, per day |

### Derived Metrics

- **CTR** = clicks / impressions
- **CPL** = cost / leads
- **ROAS** = conversion_value / cost (available but not yet surfaced!)
- **Conversion Rate** = conversions / clicks
- **Trend %** = (current - previous) / previous

---

## What Makes Insights Brilliant?

For someone validating a business idea, brilliant insights are:

1. **Answering "Is this working?"** - Not just data, but SIGNAL
2. **Actionable** - Clear next step, not just observation
3. **Prioritized** - The MOST important thing first
4. **Specific** - Named projects, concrete numbers, timeframes
5. **Honest** - Bad news delivered constructively

---

## Insight Categories (Ranked by Value)

### Tier 1: Critical (This is why they pay)

**1. Lead Velocity & Health**
The north star. Everything else is noise if you're not getting leads.

| Insight                     | Trigger                      | Example                                                                        |
| --------------------------- | ---------------------------- | ------------------------------------------------------------------------------ |
| Lead Generation Stalled     | 0 leads in 7+ days           | "[Project] hasn't generated leads in 7 days. Review your keywords or ad copy." |
| First Lead!                 | first_lead == true           | "[Project] just got its first lead! Your idea is showing early traction."      |
| Lead Velocity Increasing    | leads_trend > 20%            | "Leads are up 40% this week. Whatever you changed is working."                 |
| High Traffic, No Conversion | page_views > 200, leads == 0 | "[Project] had 500 visits but no leads. Your landing page needs work."         |

**2. Cost Efficiency**
Are you burning money or building a business?

| Insight                 | Trigger                      | Example                                                                             |
| ----------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| CPL Improving           | cpl_trend < -15%             | "Cost-per-lead dropped to $28, down 18% from last week. Your targeting is working." |
| Expensive Leads Warning | project_cpl > 2x account_avg | "[Project] is paying $85/lead vs your average $35. Consider pausing."               |
| Great ROAS              | roas > 3.0                   | "[Project] returns $5 for every $1 spent. Consider increasing budget."              |
| Bleeding Money          | spend > $100, leads == 0     | "[Project] spent $200 with no leads. Time to pause and reassess."                   |

**3. Momentum & Trends**
Is the ship heading in the right direction?

| Insight             | Trigger                          | Example                                                          |
| ------------------- | -------------------------------- | ---------------------------------------------------------------- |
| CTR Improving       | ctr_trend > 20%                  | "CTR up 23% to 4.2%. Your ads are resonating better."            |
| Engagement Dropping | ctr_trend < -25%                 | "CTR dropped 30% this week. Your ads may be fatiguing."          |
| Sudden Traffic Drop | page_views_trend < -50%          | "[Project] traffic dropped 60% in 3 days. Check your ad status." |
| Peak Performance    | leads_today > max(leads_history) | "Yesterday was your best day ever with 15 leads!"                |

### Tier 2: Important

**4. Project Comparison (Relative Performance)**

| Insight              | Trigger                               | Example                                                                    |
| -------------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| Clear Winner         | project leads > 3x others             | "[Project A] is outperforming all others: 3x more leads at half the cost." |
| Underperformer Alert | project_spend == max AND leads == min | "[Project B] has highest spend but lowest leads. Something's wrong."       |
| New Contender        | new_project metrics > established     | "[Project C] is outpacing [Project A] at the same stage."                  |

**5. Funnel Diagnosis (Where is it breaking?)**

| Insight              | Trigger                             | Example                                                                   |
| -------------------- | ----------------------------------- | ------------------------------------------------------------------------- |
| Targeting Problem    | impressions very low                | "Low impressions suggest your targeting is too narrow or budget too low." |
| Creative Problem     | high impressions, low CTR           | "High impressions but 0.5% CTR. Your ad copy isn't resonating."           |
| Landing Page Problem | high CTR, low conversion            | "Great CTR but no leads. Your landing page isn't converting."             |
| Offer Problem        | traffic + engagement good, no leads | "Traffic looks good but no one's filling out the form. Test your offer."  |

### Tier 3: Delighters

**6. Milestones & Celebrations**

| Insight              | Trigger          | Example                                                    |
| -------------------- | ---------------- | ---------------------------------------------------------- |
| First Lead Milestone | leads == 1       | "🎉 [Project] got its first lead! Validation in progress." |
| 10 Leads Milestone   | leads == 10      | "[Project] hit 10 leads. Time to think about what's next." |
| Week 1 Summary       | days_active == 7 | "[Project] completed week 1: 5 leads, $42 CPL, 3.2% CTR"   |

---

## The 3-Insight Formula

Given we show exactly 3 insights, they should cover:

1. **Lead Health** - Always include (it's the north star)
2. **Efficiency/Cost** - Always include (it's about money)
3. **Actionable Next Step** - What to do right now

### Selection Priority

When generating insights, rank by:

1. **Urgency** - Problems beat opportunities
2. **Impact** - Bigger numbers first
3. **Recency** - Things that just happened
4. **Actionability** - Clear next step available

### Sentiment Distribution

Ideal mix for motivation:

- At least 1 positive when things are going well
- Lead with the most important (even if negative)
- End with actionable (not doom)

---

## Actionable Insights Framework

Every insight should map to a user action they can take in Launch10:

### Insight → Action Mapping

| Problem Signal                  | Insight Type         | User Action         | Action URL                            |
| ------------------------------- | -------------------- | ------------------- | ------------------------------------- |
| CTR dropping / Low CTR          | Ad Creative Problem  | Review ad copy      | `/projects/:uuid/campaigns/content`   |
| High CTR, low leads             | Landing Page Problem | Review landing page | `/projects/:uuid/website`             |
| Low impressions                 | Targeting Problem    | Expand targeting    | `/projects/:uuid/campaigns/targeting` |
| Expensive CPL                   | Targeting Problem    | Narrow targeting    | `/projects/:uuid/campaigns/targeting` |
| Great ROAS / Strong performance | Scale Opportunity    | Increase budget     | `/projects/:uuid/campaigns/budget`    |
| No leads, spending money        | Cut Losses           | Pause campaign      | `/projects/:uuid/campaigns/budget`    |
| Clear winner among projects     | Focus Energy         | View project        | `/projects/:uuid`                     |

### Insight Output Schema

```typescript
interface Insight {
  title: string; // "Lead Generation Stalled" (short, scannable)
  description: string; // "Premium Pet Portraits hasn't generated leads in 7 days..."
  sentiment: "positive" | "negative" | "neutral";
  project_uuid?: string; // If project-specific
  action: {
    label: string; // "Review Keywords"
    url: string; // "/projects/abc123/campaigns/content"
  };
}
```

---

## Implementation Plan

### Phase 1: Rails Backend Additions

**1. Update InsightsMetricsService to include:**

- ROAS (conversion_value / cost)
- days_since_last_lead per project
- Pre-computed flags (has_stalled_project, has_high_performer, etc.)

**Files:**

- `app/services/analytics/insights_metrics_service.rb`

### Phase 2: Langgraph Implementation

**1. Create InsightsAnnotation** (`app/annotation/insightsAnnotation.ts`)

```typescript
// Input schema (what Rails sends)
const metricsInputSchema = z.object({
  period: z.string(),
  account_totals: z.object({...}),
  projects: z.array(z.object({...})),
  flags: z.object({...})
});

// Output schema (what LLM returns)
const insightSchema = z.object({
  title: z.string(),
  description: z.string(),
  sentiment: z.enum(["positive", "negative", "neutral"]),
  project_uuid: z.string().optional(),
  action: z.object({
    label: z.string(),
    url: z.string()
  })
});

// Graph state
const InsightsAnnotation = Annotation.Root({
  metricsInput: Annotation<MetricsInput | undefined>,
  insights: Annotation<Insight[]>,
  skipGeneration: Annotation<boolean>,  // Set by checkFreshness when cached
  generationError: Annotation<string | undefined>,
  dashboardInsightId: Annotation<number | undefined>,
});
```

**2. Create checkFreshness node** (`app/nodes/insights/checkFreshness.ts`)

- First node in graph, always runs
- Calls Rails API to check if insights are fresh
- If fresh: sets `skipGeneration: true` and populates `insights` from cache
- If stale: fetches metrics_summary for generation

**3. Create generateInsights node** (`app/nodes/insights/generateInsights.ts`)

- Takes metrics_summary from state
- Calls Claude with structured output
- Returns exactly 3 insights
- Ensures at least 1 positive (per requirement)

**4. Create saveInsights node** (`app/nodes/insights/saveInsights.ts`)

- Saves generated insights back to Rails
- Sets `generated_at` to now for freshness tracking

**5. Create insights graph** (`app/graphs/insights.ts`)

```
START → checkFreshness → [conditional] → generateInsights → saveInsights → END
                              ↓
                         [if fresh]
                              ↓
                             END (return cached)
```

**6. Create API route** (`app/server/routes/insights.ts`)

- POST /api/insights/generate
- Invokes graph, returns insights (cached or new)
- Graph handles all freshness logic internally

**Files:**

- `app/annotation/insightsAnnotation.ts`
- `app/nodes/insights/checkFreshness.ts`
- `app/nodes/insights/generateInsights.ts`
- `app/nodes/insights/saveInsights.ts`
- `app/graphs/insights.ts`
- `app/server/routes/insights.ts`
- `app/services/DashboardInsightsAPIService.ts`

### Phase 3: Frontend Integration

**1. Create useInsightsInit hook** (`hooks/useInsightsInit.ts`)

- Called on Dashboard mount
- Always calls Langgraph (single source of truth pattern)
- Langgraph handles freshness check internally
- Returns `{ insights, isLoading, error }`

**2. Update Dashboard.tsx**

- Use `useInsightsInit()` hook instead of reading insights from Rails props
- Show loading state while fetching
- Display insights from hook state

**3. Manual regeneration**

- "Regenerate Insights" button calls Rails with `regenerate_insights` param
- Rails marks insights stale (`generated_at = 1.year.ago`)
- Page reloads, `useInsightsInit` triggers fresh generation

**Files:**

- `app/javascript/frontend/hooks/useInsightsInit.ts`
- `app/javascript/frontend/pages/Dashboard.tsx`

---

## LLM Prompt Design (Critical)

```
You are an expert marketing analyst helping someone validate their business idea.

Given the metrics below, generate exactly 3 insights that will help them improve.

RULES:
1. At least 1 insight must be positive (celebrate wins)
2. Every insight must include a specific action they can take
3. Be specific: name projects, cite numbers, compare to previous periods
4. Prioritize by urgency: problems first, then opportunities
5. If a project has no leads for 7+ days, always flag it

METRICS:
{metrics_summary}

ACTIONS AVAILABLE:
- Review ad copy: /projects/:uuid/campaigns/content
- Review landing page: /projects/:uuid/website
- Adjust targeting: /projects/:uuid/campaigns/targeting
- Adjust budget: /projects/:uuid/campaigns/budget

Respond with exactly 3 insights in this JSON format:
[
  {
    "title": "Short title (5 words max)",
    "description": "2-3 sentence explanation with specific numbers",
    "sentiment": "positive|negative|neutral",
    "project_uuid": "uuid if project-specific, null if account-wide",
    "action": {
      "label": "Button text",
      "url": "/projects/uuid/path"
    }
  }
]
```

---

## Caching & Freshness Architecture

### Design Goals

1. **Langgraph as source of truth** - Frontend always calls Langgraph, same pattern as other features
2. **Rails owns freshness** - Rails determines when insights are stale (24h threshold)
3. **Idempotency** - Langgraph checks freshness before regenerating, won't duplicate work
4. **Streaming support** - New insights stream to frontend as they're generated

### Why Rails Owns Freshness

We considered having Langgraph track `generatedAt` in its checkpoint state to avoid a Rails roundtrip. However:

- Rails already has the `regenerate_insights` param for manual refresh
- Rails `DashboardInsight` model has `fresh?` / `stale?` methods
- Keeping freshness in one place (Rails) avoids sync issues
- The Rails roundtrip is fast (~50ms) compared to LLM generation (~2-3s)

### System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ RAILS                                                                       │
│                                                                             │
│  DashboardInsight                                                           │
│  ├── insights (jsonb)        # Cached insight array                         │
│  ├── metrics_summary (jsonb) # Metrics used for generation                  │
│  ├── generated_at (datetime) # When insights were generated                 │
│  └── fresh? / stale?         # 24-hour threshold                            │
│                                                                             │
│  API Endpoints:                                                             │
│  ├── GET  /api/v1/dashboard_insights          # Returns {insights, fresh}   │
│  ├── POST /api/v1/dashboard_insights          # Saves new insights          │
│  └── GET  /api/v1/dashboard_insights/metrics_summary  # Metrics for LLM     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ LANGGRAPH                                                                   │
│                                                                             │
│  Insights Graph Flow:                                                       │
│                                                                             │
│  START                                                                      │
│    │                                                                        │
│    ▼                                                                        │
│  checkFreshness ──────────────────────────────────────┐                     │
│    │ GET /api/v1/dashboard_insights                   │                     │
│    │ Returns {insights, fresh, generated_at}          │                     │
│    │                                                  │                     │
│    ├── if fresh == true ──────────────────────────────┼──▶ END              │
│    │   Return cached insights immediately             │    (return cached)  │
│    │                                                  │                     │
│    ▼ if fresh == false                                │                     │
│  fetchMetrics                                         │                     │
│    │ GET /api/v1/dashboard_insights/metrics_summary   │                     │
│    │                                                  │                     │
│    ▼                                                  │                     │
│  generateInsights                                     │                     │
│    │ LLM call with structured output                  │                     │
│    │                                                  │                     │
│    ▼                                                  │                     │
│  saveInsights                                         │                     │
│    │ POST /api/v1/dashboard_insights                  │                     │
│    │                                                  │                     │
│    ▼                                                  │                     │
│  END ◀────────────────────────────────────────────────┘                     │
│  (return new insights)                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND                                                                    │
│                                                                             │
│  Dashboard.tsx                                                              │
│    │                                                                        │
│    ├── On mount: useInsightsInit() hook                                     │
│    │     │                                                                  │
│    │     └── POST /api/insights/generate (Langgraph)                        │
│    │           │                                                            │
│    │           ├── Streams response                                         │
│    │           └── Sets insights state                                      │
│    │                                                                        │
│    └── Renders InsightCards from state                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Request Lifecycle

#### Scenario 1: Fresh Insights (< 24 hours old)

```
1. User loads Dashboard
2. Frontend calls POST /api/insights/generate (Langgraph)
3. Langgraph checkFreshness node:
   - GET /api/v1/dashboard_insights
   - Rails returns {insights: [...], fresh: true}
4. Langgraph short-circuits, returns cached insights
5. Frontend displays insights

Latency: ~100-200ms (Langgraph + Rails roundtrip, no LLM)
```

#### Scenario 2: Stale/Missing Insights

```
1. User loads Dashboard
2. Frontend calls POST /api/insights/generate (Langgraph)
3. Langgraph checkFreshness node:
   - GET /api/v1/dashboard_insights
   - Rails returns {insights: null, fresh: false} or {insights: [...], fresh: false}
4. Langgraph fetchMetrics node:
   - GET /api/v1/dashboard_insights/metrics_summary
   - Rails returns metrics data
5. Langgraph generateInsights node:
   - LLM generates 3 insights
   - Streams response to frontend
6. Langgraph saveInsights node:
   - POST /api/v1/dashboard_insights
   - Rails saves with generated_at = now
7. Frontend displays streamed insights

Latency: ~2-4s (includes LLM generation)
```

#### Scenario 3: Manual Regeneration

```
1. User clicks "Regenerate Insights" on Dashboard
2. Rails marks insights stale: insight.update!(generated_at: 1.year.ago)
3. Page reloads, Scenario 2 flow executes
```

### Frontend Implementation

```tsx
// hooks/useInsightsInit.ts
import { useEffect, useRef, useState } from "react";
import { usePage } from "@inertiajs/react";

interface DashboardProps {
  langgraph_path: string;
  jwt: string;
}

interface Insight {
  title: string;
  description: string;
  sentiment: "positive" | "negative" | "neutral";
  project_uuid?: string;
  action: { label: string; url: string };
}

export function useInsightsInit() {
  const { langgraph_path, jwt } = usePage<DashboardProps>().props;
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    if (!langgraph_path || !jwt) return;

    hasInitialized.current = true;
    setIsLoading(true);

    fetch(`${langgraph_path}/api/insights/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setInsights(data.insights);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [langgraph_path, jwt]);

  return { insights, isLoading, error };
}
```

### Langgraph Implementation

```ts
// nodes/insights/checkFreshness.ts
export const checkFreshnessNode = NodeMiddleware.use(
  {},
  async (
    state: InsightsGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<InsightsGraphState>> => {
    const jwt = config?.configurable?.jwt as string | undefined;
    if (!jwt) {
      return { generationError: "No JWT token provided" };
    }

    const apiService = new DashboardInsightsAPIService({ jwt });
    const existing = await apiService.get(); // GET /api/v1/dashboard_insights

    if (existing.fresh && existing.insights?.length > 0) {
      return {
        insights: existing.insights,
        skipGeneration: true,
      };
    }

    // Stale - need to fetch metrics and generate
    const metricsInput = await apiService.getMetricsSummary();
    return { metricsInput };
  }
);

// graphs/insights.ts
export const insightsGraph = new StateGraph(InsightsAnnotation)
  .addNode("checkFreshness", checkFreshnessNode)
  .addNode("generateInsights", generateInsightsNode)
  .addNode("saveInsights", saveInsightsNode)
  .addEdge(START, "checkFreshness")
  .addConditionalEdges("checkFreshness", (state) =>
    state.skipGeneration ? END : "generateInsights"
  )
  .addEdge("generateInsights", "saveInsights")
  .addEdge("saveInsights", END);
```

### Key Benefits

1. **Single source of truth** - Frontend always calls Langgraph, no local state merging
2. **Idempotent** - Multiple calls won't regenerate if still fresh
3. **Consistent pattern** - Same as useWebsiteInit, useStageInit, etc.
4. **Graceful degradation** - If Langgraph is down, Rails can still serve cached insights
5. **Manual refresh** - Rails `regenerate_insights` param works naturally

### Edge Cases

| Scenario                         | Behavior                                                |
| -------------------------------- | ------------------------------------------------------- |
| First ever load (no insights)    | fresh=false, generates new                              |
| Insights exist but > 24h old     | fresh=false, regenerates                                |
| Langgraph down, Rails has cached | Frontend falls back to Rails props (future enhancement) |
| LLM generation fails             | Returns error, existing insights preserved in Rails     |
| Concurrent requests              | Second request sees fresh=true from first's save        |

---

## Verification

### Unit Tests

1. **checkFreshness node**: Returns cached insights when fresh, fetches metrics when stale
2. **generateInsights node**: Returns valid schema, exactly 3 insights, at least 1 positive
3. **saveInsights node**: Successfully saves to Rails API

### Integration Tests

1. **Fresh path**: Graph returns cached insights without LLM call
2. **Stale path**: Graph fetches metrics, generates, saves, returns new insights
3. **Idempotency**: Concurrent requests don't cause duplicate generation

### E2E Tests

1. **Dashboard load**: Insights appear (cached or generated)
2. **Regenerate button**: Marks stale, regenerates on reload
3. **Error handling**: Graceful degradation if Langgraph fails
