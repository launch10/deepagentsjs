# Analytics Insights

The insights system generates 3 actionable AI insights from analytics metrics. It runs as a Langgraph graph that fetches metrics from Rails, checks freshness, and generates new insights using an LLM with structured output. Insights are cached for 1 hour.

## How It Works

```
POST /api/insights/stream { threadId }
       │
       ▼
insightsGraph
  START → fetchMetrics → [fresh?] ─yes─→ END (return cached)
                           │ no
                           ▼
                    generateInsights → saveInsights → END
```

1. **fetchMetrics**: Calls Rails API for `DashboardInsight` freshness. If < 1 hour old, returns cached insights. Otherwise fetches raw metrics summary.
2. **generateInsights**: LLM generates exactly 3 insights with structured output (title, description, sentiment, action_type).
3. **saveInsights**: Persists to Rails for caching.

## The 3-Insight Formula

Every generation produces exactly 3 insights covering:

1. **Lead Health** — the north star metric (leads coming in? stalling?)
2. **Efficiency/Cost** — CPL, ROAS, spend optimization
3. **Actionable Next Step** — specific action the user should take

## Signal Detection

| Signal | Threshold | Severity |
|--------|-----------|----------|
| Lead stall | days_since_last_lead >= 7 | URGENT |
| CPL improving | trend down >= 15% | POSITIVE |
| CPL worsening | trend up >= 20% | WARNING |
| Great ROAS | >= 3.0 | POSITIVE |
| Traffic crash | trend down >= 50% | URGENT |
| Bleeding money | spend > $100, 0 leads | URGENT |
| High traffic, no leads | 200+ page views, 0 leads | WARNING |

## Metrics Input

```typescript
{
  period: "Last 30 Days",
  totals: { leads, page_views, ctr, cpl, roas, total_spend_dollars },
  trends: { leads_trend, page_views_trend, ctr_trend, cpl_trend },
  projects: [{ name, uuid, leads, page_views, ctr, cpl, roas, spend }],
  flags: { has_stalled_project, has_high_performer, has_new_first_lead }
}
```

## Data Model

**AnalyticsDailyMetric** — one row per project per day:
- Fields: `clicks`, `impressions`, `cost_micros`, `leads_count`, `page_views_count`, `unique_visitors_count`, `conversion_value_cents`
- Computed: `ctr()`, `cpl_dollars()`, `cost_dollars()`
- Unique index: `(account_id, project_id, date)`

## Key Files Index

| File | Purpose |
|------|---------|
| `langgraph_app/app/graphs/insights.ts` | Insights graph definition |
| `langgraph_app/app/nodes/insights/fetchMetrics.ts` | Freshness check + metrics fetch |
| `langgraph_app/app/nodes/insights/generateInsights.ts` | LLM generation with structured output |
| `langgraph_app/app/nodes/insights/saveInsights.ts` | Persist to Rails |
| `rails_app/app/models/analytics_daily_metric.rb` | Daily metrics aggregation |

## Gotchas

- **1-hour cache**: Insights are cached for 1 hour. If metrics change dramatically within that window, insights may be stale.
- **Onboarding fallback**: If the user has no projects, the system returns hardcoded "get started" insights instead of calling the LLM.
- **At least 1 positive**: The prompt instructs the LLM to include at least 1 positive insight when metrics warrant it, to avoid discouraging users.
