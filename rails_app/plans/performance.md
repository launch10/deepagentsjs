# Project Performance Page Implementation Plan

**Status: IMPLEMENTED**

## Summary of Changes

### Files Created

- `db/migrate/20260130161923_add_conversion_value_cents_to_analytics_daily_metrics.rb` - Migration for ROAS tracking
- `app/services/analytics/project_performance_service.rb` - Service for project-scoped metrics
- `app/javascript/frontend/pages/ProjectPerformance.tsx` - Frontend page component
- `spec/services/analytics/project_performance_service_spec.rb` - Service specs

### Files Modified

- `app/models/analytics_daily_metric.rb` - Added `conversion_value_dollars` and `roas` methods
- `app/services/analytics/compute_metrics_service.rb` - Added `aggregate_conversion_value` method
- `config/routes/subscribed.rb` - Added `get :performance` route
- `app/controllers/projects_controller.rb` - Added `performance` action
- `app/javascript/frontend/pages/Dashboard.tsx` - Added "View Performance" link to ProjectCard
- `spec/models/analytics_daily_metric_spec.rb` - Added specs for new model methods
- `spec/factories/analytics_daily_metrics.rb` - Added `conversion_value_cents` field
- `spec/requests/projects_spec.rb` - Added request specs for performance endpoint

---

## Overview

Implement individual project performance pages at `projects/{uuid}/performance` based on the Figma design. This page shows ad performance metrics for a single project, reusing much of the existing Dashboard infrastructure.

## Figma Design Summary

**Header:**

- "Performance" title with project name subtitle
- Back link to "< Projects"
- Date filter dropdown (includes "All time" option)

**4 Summary Cards:**

1. **Ad Spend** - Total cost for date range
2. **Leads** - Form submissions (with "View Leads" link)
3. **Avg Cost per Lead** - Spend required to generate a lead
4. **Return on Ad Spend (ROAS)** - Revenue earned from ad spend

**3 Time Series Charts (bar/line):**

1. **Impressions** - Bar chart
2. **Ad Clicks** - Bar chart
3. **Click-Through Rate** - Line chart (percentage)

## Data Availability Analysis

| Metric      | Available | Source                                                                       |
| ----------- | --------- | ---------------------------------------------------------------------------- |
| Ad Spend    | ✅        | `analytics_daily_metric.cost_micros`                                         |
| Leads       | ✅        | `analytics_daily_metric.leads_count`                                         |
| CPL         | ✅        | Computed: `cost_dollars / leads_count`                                       |
| **ROAS**    | ⚠️        | Requires migration: add `conversion_value_cents` to `analytics_daily_metric` |
| Impressions | ✅        | `analytics_daily_metric.impressions`                                         |
| Ad Clicks   | ✅        | `analytics_daily_metric.clicks`                                              |
| CTR         | ✅        | Computed: `clicks / impressions`                                             |

**ROAS Implementation:** Use local L10.track conversion data from `Ahoy::Event` (name: "conversion", properties: { value, currency }).

**Why use local data instead of Google Ads `conversion_value_micros`:**

1. L10.track already captures conversion value when `L10.createLead(email, { value: 99, currency: "USD" })` is called
2. Data stored in `Ahoy::Event` with `name: "conversion"` and `properties: { value, currency }`
3. Works across all platforms (Google, Meta, LLM ads) - no platform-specific queries
4. No external API dependency - data is already in our database
5. Values are in the user's specified currency (typically USD, stored as dollars)

## Implementation Plan

### 1. Database: Migration for conversion_value_cents

**File:** `db/migrate/XXXXXX_add_conversion_value_cents_to_analytics_daily_metrics.rb`

```ruby
class AddConversionValueCentsToAnalyticsDailyMetrics < ActiveRecord::Migration[8.0]
  def change
    add_column :analytics_daily_metrics, :conversion_value_cents, :bigint, default: 0, null: false
  end
end
```

Note: Using cents (not micros) because L10.track captures values in dollars (e.g., `value: 99` = $99.00). Storing as cents avoids floating point issues.

### 2. Backend: Update ComputeMetricsService

**File:** `app/services/analytics/compute_metrics_service.rb`

Add method to aggregate conversion values from Ahoy::Event:

```ruby
def aggregate_conversion_value
  return 0 unless @project.website

  # Get conversion events for this website's visits on this date
  visit_ids = Ahoy::Visit
    .where(website: @project.website)
    .where(started_at: @date.all_day)
    .pluck(:id)

  return 0 if visit_ids.empty?

  # Sum conversion values from conversion events
  conversion_events = Ahoy::Event
    .where(visit_id: visit_ids, name: "conversion")
    .where(time: @date.all_day)

  # Value is stored in dollars in properties['value'], convert to cents
  total_dollars = conversion_events.sum { |e| e.properties["value"].to_f }
  (total_dollars * 100).to_i
end
```

Update the `call` method to include `conversion_value_cents`:

```ruby
def call
  AnalyticsDailyMetric.upsert(
    {
      # ... existing fields ...
      conversion_value_cents: aggregate_conversion_value,
      # ...
    },
    unique_by: [:account_id, :project_id, :date]
  )
end
```

### 3. Backend: Update AnalyticsDailyMetric Model

**File:** `app/models/analytics_daily_metric.rb`

Add computed methods:

```ruby
# Conversion value in dollars (from cents)
def conversion_value_dollars
  conversion_value_cents / 100.0
end

# Return on Ad Spend: conversion_value / cost
def roas
  return nil if cost_micros.zero?
  conversion_value_dollars / cost_dollars
end
```

### 4. Backend: Route

**File:** `config/routes/subscribed.rb`

Add `performance` as a member route:

```ruby
resources :projects, only: [:new, :show], param: :uuid do
  member do
    get :brainstorm
    get :website
    get :performance  # NEW
    # ... existing routes
  end
end
```

### 5. Backend: Service

**File:** `app/services/analytics/project_performance_service.rb`

Create a project-scoped version of DashboardService:

```ruby
module Analytics
  class ProjectPerformanceService
    def initialize(project, days: 30)
      @project = project
      @days = days
      @start_date = days.days.ago.to_date
      @end_date = Date.current
    end

    def metrics
      {
        summary: build_summary,
        impressions: build_time_series(:impressions),
        clicks: build_time_series(:clicks),
        ctr: build_ctr_time_series
      }
    end

    private

    def build_summary
      totals = AnalyticsDailyMetric
        .for_project(@project)
        .for_date_range(@start_date, @end_date)
        .select(
          "SUM(cost_micros) as total_cost_micros",
          "SUM(leads_count) as total_leads",
          "SUM(impressions) as total_impressions",
          "SUM(clicks) as total_clicks",
          "SUM(conversion_value_cents) as total_conversion_value_cents"
        ).first

      cost_dollars = (totals.total_cost_micros || 0) / 1_000_000.0
      leads = totals.total_leads || 0

      conversion_value_dollars = (totals.total_conversion_value_cents || 0) / 100.0
      roas = cost_dollars > 0 ? (conversion_value_dollars / cost_dollars).round(2) : nil

      {
        ad_spend: cost_dollars.round(2),
        leads: leads,
        cpl: leads > 0 ? (cost_dollars / leads).round(2) : nil,
        roas: roas
      }
    end

    def build_time_series(column)
      # Query daily values
      daily_data = AnalyticsDailyMetric
        .for_project(@project)
        .for_date_range(@start_date, @end_date)
        .select(:date, column)
        .order(:date)
        .group_by_day(:date, format: "%Y-%m-%d")
        .sum(column)

      # Fill gaps with zeros
      dates = (@start_date..@end_date).to_a
      data = dates.map { |d| daily_data[d.to_s] || 0 }

      {
        dates: dates.map(&:to_s),
        data: data,
        totals: calculate_totals(data)
      }
    end

    def calculate_totals(data)
      current = data.sum
      midpoint = data.length / 2
      previous = data[0...midpoint].sum
      current_half = data[midpoint..].sum

      trend_percent = previous > 0 ? ((current_half - previous).to_f / previous * 100).round(1) : 0

      {
        current: current,
        previous: previous,
        trend_percent: trend_percent.abs,
        trend_direction: trend_percent > 0 ? "up" : (trend_percent < 0 ? "down" : "flat")
      }
    end
  end
end
```

### 6. Backend: Controller Action

**File:** `app/controllers/projects_controller.rb`

Add performance action:

```ruby
def performance
  service = Analytics::ProjectPerformanceService.new(@project, days: params[:days]&.to_i || 30)

  render inertia: "ProjectPerformance", props: {
    project: @project.to_mini_json,
    metrics: all_metrics_for_date_ranges,
    date_range_options: [
      { days: 7, label: "Last 7 days" },
      { days: 30, label: "Last 30 days" },
      { days: 90, label: "Last 90 days" },
      { days: 0, label: "All time" }  # Special case: 0 = all time
    ]
  }
end

private

def all_metrics_for_date_ranges
  [7, 30, 90, 0].each_with_object({}) do |days, hash|
    effective_days = days == 0 ? days_since_first_data : days
    service = Analytics::ProjectPerformanceService.new(@project, days: effective_days)
    hash[days.to_s] = service.metrics
  end
end

def days_since_first_data
  first_metric = @project.analytics_daily_metrics.order(:date).first
  return 30 unless first_metric
  (Date.current - first_metric.date).to_i
end
```

### 7. Frontend: Page Component

**File:** `app/javascript/frontend/pages/ProjectPerformance.tsx`

Key differences from Dashboard:

- Single project focus (no multi-project series)
- Summary cards at top (Ad Spend, Leads, CPL, ROAS)
- Bar charts for Impressions/Clicks (not area charts)
- Line chart for CTR
- "View Leads" link in leads card
- "All time" date range option

Reusable from Dashboard:

- `ChartContainer` and chart utilities
- Date range switching pattern (pre-fetch all ranges)
- Trend indicator styling
- Color palette and design tokens

### 8. Frontend: Navigation

Add link to performance page from:

- Project show page header
- ProjectCard component in Dashboard

## Files to Create/Modify

| File                                                                      | Action                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------- |
| `db/migrate/XXX_add_conversion_value_cents_to_analytics_daily_metrics.rb` | Create migration                                  |
| `app/models/analytics_daily_metric.rb`                                    | Add `conversion_value_dollars` and `roas` methods |
| `app/services/analytics/compute_metrics_service.rb`                       | Add `aggregate_conversion_value` from Ahoy::Event |
| `config/routes/subscribed.rb`                                             | Add `get :performance` route                      |
| `app/controllers/projects_controller.rb`                                  | Add `performance` action                          |
| `app/services/analytics/project_performance_service.rb`                   | Create new service                                |
| `app/javascript/frontend/pages/ProjectPerformance.tsx`                    | Create new page                                   |
| `app/javascript/frontend/pages/Dashboard.tsx`                             | Add performance link to ProjectCard               |

## Verification

1. **Route works:** Visit `/projects/{uuid}/performance` for an existing project
2. **Data loads:** Verify metrics match what's shown on Dashboard for that project
3. **Date ranges:** Switch between 7/30/90/all-time and verify data updates
4. **Charts render:** All 3 charts display with correct data
5. **Links work:** "View Leads" navigates to leads page, back link works
6. **Empty state:** Projects with no data show appropriate messaging

## Notes

- **Chart Types:** Figma shows bar charts for Impressions/Clicks vs. area charts in Dashboard. Will implement as shown in Figma (bar charts for volume metrics, line chart for CTR percentage).
- **Backfill:** After migration, existing `analytics_daily_metrics` rows will have `conversion_value_cents = 0`. The daily compute job will populate new data going forward. A backfill rake task could query historical Ahoy::Event conversion data if needed.
- **L10.track Integration:** Conversion values come from `L10.createLead(email, { value: 99, currency: "USD" })` calls, stored in `Ahoy::Event` with `name: "conversion"` and `properties: { value, currency, email, lead_id }`. This approach works for all ad platforms (Google, Meta, LLM) without platform-specific API queries.
