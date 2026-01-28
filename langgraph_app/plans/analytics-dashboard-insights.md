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
```

**2. Create generateInsights node** (`app/nodes/generateInsights.ts`)

- Takes metrics_summary from state
- Calls Claude with structured output
- Returns exactly 3 insights
- Ensures at least 1 positive (per requirement)

**3. Create insights graph** (`app/graphs/insights.ts`)

- Single node graph for now
- Input: metrics_summary
- Output: insights array

**4. Create API route** (`app/routes/insights.ts`)

- POST /api/insights/generate
- Accepts metrics_summary, returns insights
- Saves to dashboard_insights table via Rails API

**Files:**

- `app/annotation/insightsAnnotation.ts`
- `app/nodes/generateInsights.ts`
- `app/graphs/insights.ts`
- `app/routes/insights.ts`

### Phase 3: Integration

**1. Frontend calls Langgraph** when:

- Dashboard loads with stale/no insights
- User clicks "Regenerate Insights"

**2. Langgraph saves insights** back to Rails via API call

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

## Verification

1. **Unit tests**: generateInsights node returns valid schema
2. **Integration test**: Full flow from metrics → insights → saved to DB
3. **Manual test**: Load dashboard, verify insights render, click actions work
