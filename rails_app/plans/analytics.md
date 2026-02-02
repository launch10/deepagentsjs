# Analytics Data Architecture

This document describes the data patterns used across Launch10's analytics features (Dashboard, Project Performance, etc.).

## Data Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL DATA SOURCES                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Google Ads API ──(hourly sync)──► ad_performance_daily                    │
│        │                                   │                                 │
│        │                                   │  ┌─────────────────────────┐   │
│   2-4 hr API lag                           │  │   IN-HOUSE TABLES       │   │
│                                            │  │   (real-time writes)    │   │
│                                            │  ├─────────────────────────┤   │
│                                            │  │ • website_leads         │   │
│                                            │  │ • ahoy_visits           │   │
│                                            │  │ • ahoy_events           │   │
│                                            │  └─────────────────────────┘   │
│                                            │               │                 │
└────────────────────────────────────────────┼───────────────┼─────────────────┘
                                             │               │
                                             ▼               ▼
                                    ┌─────────────────────────────┐
                                    │   DAILY PRE-COMPUTE (5 AM)  │
                                    │   ComputeDailyMetricsWorker │
                                    └─────────────────────────────┘
                                                   │
                                                   ▼
                                    ┌─────────────────────────────┐
                                    │   analytics_daily_metrics   │
                                    │   (one row per project/day) │
                                    └─────────────────────────────┘
                                                   │
                         ┌─────────────────────────┴─────────────────────────┐
                         │                                                   │
                         ▼                                                   ▼
              ┌─────────────────────┐                          ┌─────────────────────┐
              │   HISTORICAL DATA   │                          │   TODAY'S DATA      │
              │   (before today)    │                          │   (live queries)    │
              │                     │                          │                     │
              │   Source:           │                          │   Source:           │
              │   analytics_daily_  │                          │   • ad_performance_ │
              │   metrics           │                          │     daily           │
              │                     │                          │   • website_leads   │
              │   Updated: daily    │                          │   • ahoy_events     │
              └─────────────────────┘                          │                     │
                                                               │   Updated: real-time│
                                                               └─────────────────────┘
```

## The Hybrid Data Pattern

We use a **hybrid approach** that balances query performance with data freshness:

| Time Period | Data Source | Why |
|-------------|-------------|-----|
| **Historical** (before today) | `analytics_daily_metrics` | Fast queries on pre-aggregated, indexed data |
| **Today** | Live source tables | Real-time freshness for in-house data |

### Why Not Just Pre-Computed?

Pre-computed data is only generated at 5 AM. If we only used pre-computed data, today's metrics would show as zero until tomorrow morning.

### Why Not Just Live Queries?

Querying raw source tables for 90 days of data across all metrics would be slow and expensive. Pre-computed data gives us fast historical queries.

## Data Freshness Guarantees

| Data Source | Raw Freshness | With 15-min Cache | Notes |
|-------------|---------------|-------------------|-------|
| **Leads** (website_leads) | Real-time | ≤15 min | Created on form submission |
| **Conversions** (ahoy_events) | Real-time | ≤15 min | Created on conversion event |
| **Page Views** (ahoy_events) | Real-time | ≤15 min | Created on page load |
| **Visitors** (ahoy_visits) | Real-time | ≤15 min | Created on session start |
| **Google Ads** (ad_performance_daily) | 3-5 hours | ≤5 hours | Hourly sync + 2-4hr API lag |

### Google Ads Freshness Breakdown

```
User action on ad
       │
       ▼ (2-4 hours)
Google Ads API reflects data
       │
       ▼ (up to 1 hour)
Hourly sync job runs (GoogleAds::SyncPerformanceWorker)
       │
       ▼ (immediate)
ad_performance_daily table updated
       │
       ▼ (up to 15 min)
Cache expires, next request sees new data
```

**Total worst-case latency for Google Ads: ~5 hours**

## Date Boundary (Preventing Double-Counting)

The boundary between historical and live data is **intentionally exclusive**:

```ruby
# Historical: start_date → Date.yesterday (EXCLUDES today)
def historical_metrics
  AnalyticsDailyMetric
    .for_date_range(@start_date, Date.yesterday)
end

# Live: Date.current only
def live_leads_count_today
  WebsiteLead
    .where(created_at: Date.current.all_day)
    .count
end
```

### Why This Matters

If the daily pre-compute job runs mid-day (or is triggered manually), it might create an `analytics_daily_metrics` record for today. By excluding today from historical queries, we ensure:

1. Today's data comes **only** from live source tables
2. No double-counting can occur
3. The boundary is deterministic and easy to reason about

### Edge Case: analytics_daily_metrics Exists for Today

If someone accidentally creates a pre-computed record for today:
- It will be **ignored** by historical queries (which stop at `Date.yesterday`)
- Live queries will still run for today
- No double-counting occurs

This is covered by tests in `spec/services/analytics/project_performance_service_spec.rb` under "date boundary - no double counting".

## Cache Strategy

We use `Analytics::CacheService` with a **15-minute TTL**:

```ruby
CacheService.fetch(account_id, "project:#{project.id}:performance", days) do
  compute_metrics  # Only runs on cache miss
end
```

### Why 15 Minutes?

- **In-house data**: Real-time data with 15-min staleness is acceptable for dashboards
- **Google Ads data**: Already 3-5 hours stale, so 15 min adds negligible delay
- **Database protection**: Prevents hammering live tables on page refreshes

### Cache Key Structure

```
analytics:{account_id}:{metric}:{days}:{time_bucket}
```

Example: `analytics:123:project:456:performance:30:202601301545`

The time bucket (15-min intervals) ensures cache expires naturally without explicit invalidation.

## Services Using This Pattern

| Service | Purpose | Uses Hybrid Pattern? |
|---------|---------|---------------------|
| `Analytics::DashboardService` | Account-level overview | Yes |
| `Analytics::ProjectPerformanceService` | Single project metrics | Yes |
| `Analytics::Metrics::LeadsMetric` | Leads time series | Yes |
| `Analytics::Metrics::PageViewsMetric` | Page views time series | Yes |
| `Analytics::Metrics::UniqueVisitorsMetric` | Visitors time series | Yes |
| `Analytics::Metrics::GoogleAdsMetric` | CTR/CPL time series | Yes |

## Background Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `GoogleAds::SyncPerformanceWorker` | Hourly | Sync Google Ads → ad_performance_daily |
| `Analytics::ComputeDailyMetricsWorker` | Daily 5 AM | Aggregate → analytics_daily_metrics |

## Adding New Analytics Features

When adding new analytics features:

1. **Use the hybrid pattern** - historical from `analytics_daily_metrics`, today from live tables
2. **Respect the date boundary** - `Date.yesterday` for historical, `Date.current` for live
3. **Use `Date.current`** not `Date.today` - respects Rails timezone
4. **Wrap in `CacheService.fetch`** - protects live queries
5. **Add boundary tests** - verify no double-counting at the date boundary
6. **Document freshness** - be clear about staleness guarantees

## Related Files

- `app/services/analytics/cache_service.rb` - Caching with 15-min TTL
- `app/services/analytics/dashboard_service.rb` - Account-level dashboard
- `app/services/analytics/project_performance_service.rb` - Project performance page
- `app/services/analytics/compute_metrics_service.rb` - Daily pre-compute logic
- `app/workers/analytics/compute_daily_metrics_worker.rb` - Daily job coordinator
- `schedule.rb` - Job schedules (hourly sync, daily pre-compute)
