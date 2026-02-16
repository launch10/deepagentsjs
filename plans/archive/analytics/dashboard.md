# Analytics Dashboard - Implementation Plan

## Overview

Build the analytics dashboard at `/dashboard` (SubscribedController), backed by a hybrid pre-computed + live-query API with 15-minute Rails cache. The dashboard shows: Performance Overview (4 time-series charts), Projects Table with per-project stats, and Key Insights (AI-generated via Langgraph).

---

## Data Sources

| Metric             | Source                                                                          | Status        |
| ------------------ | ------------------------------------------------------------------------------- | ------------- |
| **Total Leads**    | `website_leads` table (created_at, website_id)                                  | Available now |
| **Page Views**     | `domain_request_counts` table (Cloudflare hourly traffic per domain)            | Available now |
| **CTR**            | Google Ads `metrics.ctr` via `search_stream()` → `ad_performance_daily`         | API confirmed |
| **Cost-per-Lead**  | `ad_performance_daily.cost_micros` / `website_leads` count                      | API confirmed |
| **Total Ad Spend** | Google Ads `metrics.cost_micros` via `search_stream()` → `ad_performance_daily` | API confirmed |

---

## Google Ads Reporting API (Resolved)

We use `GoogleAdsService.search_stream()` (preferred for bulk reporting) with GAQL. The existing `GoogleAds.client` and `client.service.google_ads` already support this. Key details:

**GAQL Query**:

```gaql
SELECT
  campaign.id, campaign.name,
  segments.date,
  metrics.impressions, metrics.clicks, metrics.ctr,
  metrics.cost_micros, metrics.conversions,
  metrics.conversion_value, metrics.conversions_value_per_cost
FROM campaign
WHERE segments.date BETWEEN '{start}' AND '{end}'
  AND campaign.status != 'REMOVED'
ORDER BY segments.date DESC
```

**Ruby call**: `client.service.google_ads.search_stream(customer_id:, query:)`

**Available pre-calculated metrics**: `metrics.ctr` (CTR), `metrics.conversions_value_per_cost` (ROAS). We also store raw values for custom computation.

**Gem examples for reference**: `examples/misc/campaign_report_to_csv.rb`, `examples/reporting/parallel_report_download.rb`

### Remaining Research Spike: Google Ads Reporting Latency

**Question**: How delayed is Google Ads reporting data in practice? (Expected: 3-12 hours.) This affects whether our 6-hour sync interval is sufficient or if we should only query for yesterday's data.

**Who**: Engineer with Google Ads API access to test with our test account (ID: 124-895-7009).

---

## Key Insights (Langgraph AI)

AI-generated insight cards ("Lead Generation Stalled", "CTR Improved", etc.) using a Langgraph graph. Cached in database for 24 hours, regenerated on-demand.

### Architecture

```
User visits /dashboard
    ↓
Rails DashboardController
    ↓
┌───────────────────────────────────────────────────┐
│ If fresh insights exist (< 24h):                  │
│   → Serve from dashboard_insights table           │
│   → Include in Inertia props                      │
│                                                   │
│ Else:                                             │
│   → insights: null + metrics_summary in props     │
│   → Frontend triggers Langgraph generation        │
└───────────────────────────────────────────────────┘
    ↓
Frontend useInsightsInit hook
    ↓
POST /api/insights/stream (Langgraph)
    ↓
┌───────────────────────────────────────────────────┐
│ generateInsights node:                            │
│   1. LLM analyzes metrics_summary                 │
│   2. Returns 3 structured insights                │
│   3. Saves to dashboard_insights table            │
└───────────────────────────────────────────────────┘
    ↓
Frontend displays insights cards
```

### Insight Card Schema

```typescript
{
  title: string,           // e.g., "Lead Generation Stalled"
  description: string,     // e.g., "Premium Pet Portraits hasn't generated leads in 7 days."
  sentiment: "positive" | "negative" | "neutral",
  metric_type: "leads" | "page_views" | "ctr" | "cpl" | "spend",
  project_uuid?: string,   // Optional: specific project this insight relates to
  action_label?: string,   // e.g., "Review" - defaults to "Review"
  action_url?: string      // e.g., "/projects/123/website" - deep link
}
```

### Key Design Decisions

1. **Database caching** - Insights stored in `dashboard_insights` table with 24-hour freshness
2. **Rails pre-computes metrics** - Sends a compact `metrics_summary` to Langgraph (no Langgraph-side data fetching)
3. **On-visit generation** - Only generates when user visits dashboard and insights are stale (saves AI credits)
4. **useStageInit pattern** - Frontend hook triggers generation automatically if needed
5. **withStructuredOutput** - LLM returns exactly 3 typed insights using Zod schema
6. **Credit tracking** - Uses `withCreditExhaustion` wrapper and `createAppBridge` for automatic billing

---

## Implementation Steps

### Step 1: Database Migrations

**Create**: `rails_app/db/migrate/XXXXXX_create_analytics_daily_metrics.rb`

```ruby
create_table :analytics_daily_metrics do |t|
  t.bigint :account_id, null: false
  t.bigint :project_id, null: false
  t.date :date, null: false
  t.integer :leads_count, default: 0, null: false
  t.bigint :page_views_count, default: 0, null: false
  t.bigint :impressions, default: 0, null: false
  t.bigint :clicks, default: 0, null: false
  t.bigint :cost_micros, default: 0, null: false
  t.timestamps
end
add_index :analytics_daily_metrics, [:account_id, :project_id, :date],
  unique: true, name: "idx_analytics_daily_acct_proj_date"
add_index :analytics_daily_metrics, [:account_id, :date],
  name: "idx_analytics_daily_acct_date"
add_foreign_key :analytics_daily_metrics, :accounts
add_foreign_key :analytics_daily_metrics, :projects
```

**Create**: `rails_app/db/migrate/XXXXXX_create_ad_performance_daily.rb`

```ruby
create_table :ad_performance_daily do |t|
  t.bigint :campaign_id, null: false
  t.date :date, null: false
  t.bigint :impressions, default: 0, null: false
  t.bigint :clicks, default: 0, null: false
  t.bigint :cost_micros, default: 0, null: false
  t.decimal :conversions, precision: 12, scale: 2, default: 0, null: false
  t.bigint :conversion_value_micros, default: 0, null: false
  t.timestamps
end
add_index :ad_performance_daily, [:campaign_id, :date],
  unique: true, name: "idx_ad_perf_daily_campaign_date"
add_foreign_key :ad_performance_daily, :campaigns
```

**Why two tables**:
- `ad_performance_daily` stores **raw** Google Ads data per campaign per day - unmassaged, exactly as returned from the API. This is our source-of-truth. We can always re-transform without re-fetching.
- `analytics_daily_metrics` is the **transformed** rollup (account-scoped, one row per project per day, all metrics combined). Can be fully recomputed from raw sources.

### Step 2: Models

**Create**: `rails_app/app/models/analytics_daily_metric.rb`

- Scoped to account, validates uniqueness on (account_id, project_id, date)
- Scopes: `for_date_range(start, end)`, `for_project(project)`, `for_account(account)`
- Computed methods: `ctr` (clicks/impressions), `cpl_dollars` (cost_micros/leads/1M), `cost_dollars` (cost_micros/1M)

**Create**: `rails_app/app/models/ad_performance_daily.rb`

- belongs_to :campaign
- Scopes: `for_date_range(start, end)`, `for_campaign(campaign)`
- Helpers: `cost_dollars`, `ctr`

### Step 3: Analytics Service Layer

**Create**:

```
rails_app/app/services/analytics/
  dashboard_service.rb          # Orchestrator
  cache_service.rb              # Cache key management + pre-computed/live merge
  metrics/
    leads_metric.rb             # Leads time series from website_leads
    page_views_metric.rb        # Page views time series from domain_request_counts
    google_ads_metric.rb        # CTR, CPL, spend from ad_performance_daily (graceful degradation)
```

#### `Analytics::DashboardService` (orchestrator)

```ruby
DATE_RANGES = [
  { label: "Last 7 Days", days: 7 },
  { label: "Last 14 Days", days: 14 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 60 Days", days: 60 },
  { label: "Last 90 Days", days: 90 }
]

def initialize(account, days:, status_filter:)
  # Sets @account, @start_date, @end_date, @status_filter
end

def performance_overview
  {
    leads: leads_metric.time_series,
    page_views: page_views_metric.time_series,
    ctr: google_ads_metric.ctr_time_series,
    cpl: google_ads_metric.cpl_time_series
  }
end

def projects_summary
  # Single aggregated query from analytics_daily_metrics + project metadata
end
```

#### `Analytics::CacheService` (cache + merge)

**Cache key**: `analytics/{account_id}/{metric}/{days}/{15min_bucket}`

- `15min_bucket = Time.current.strftime("%Y%m%d%H") + (Time.current.min / 15).to_s`
- TTL: 15 minutes via `Rails.cache.fetch(..., expires_in: 15.minutes)`

**Merge strategy** (the critical design piece):

- For dates `< Date.current` (yesterday and older): read from `analytics_daily_metrics` (pre-computed)
- For `Date.current` (today): query live from source tables (`website_leads`, `domain_request_counts`)
- This simplifies the "6-hour cutoff" into a clean day boundary since charts aggregate by day

#### Each metric class returns:

```ruby
{
  dates: ["2026-01-20", "2026-01-21", ...],
  series: [
    { project_id: 1, project_name: "Premium Pet Portraits", data: [5, 12, 8, ...] }
  ],
  totals: { current: 145, trend_percent: 12.5, trend_direction: "up" },
  available: true  # false for Google Ads when not connected
}
```

**Trend calculation**: `this_week_sum` vs `last_week_sum` for each metric.

#### Google Ads graceful degradation

When no `ads_account` or no campaigns exist, CTR/CPL/spend return:

```ruby
{ dates: [...], series: [], totals: { current: 0, trend_percent: nil }, available: false,
  message: "Connect Google Ads to see this data" }
```

### Step 4: Pre-computation Worker

**Create**: `rails_app/app/workers/analytics/compute_daily_metrics_worker.rb`

- Takes optional `date` argument (defaults to yesterday)
- For each account, for each project:
  - Count leads from `website_leads` for that project's websites on that date
  - Sum page views from `domain_request_counts` for that project's domains on that date
  - Sum impressions/clicks/cost from `ad_performance_daily` for that project's campaigns on that date
  - Upsert into `analytics_daily_metrics`

### Step 5: Google Ads Performance Sync

**Create**: `rails_app/app/services/google_ads/resources/campaign_performance.rb`

- `include Instrumentable` (follows existing pattern from `campaign.rb`)
- Uses `GoogleAds.client.service.google_ads.search_stream` (streaming, preferred for bulk reporting) with GAQL query
- GAQL query with date filter:
  ```gaql
  SELECT campaign.id, segments.date, metrics.impressions, metrics.clicks,
         metrics.ctr, metrics.cost_micros, metrics.conversions,
         metrics.conversions_value, metrics.conversions_value_per_cost
  FROM campaign
  WHERE segments.date BETWEEN '{start_date}' AND '{end_date}'
    AND campaign.status != 'REMOVED'
  ```
- `fetch_daily_metrics(start_date:, end_date:)` returns **raw** data as array of `{ date, google_campaign_id, impressions, clicks, ctr, cost_micros, conversions, conversion_value_micros }`
- Error handling: returns `[]` on `Google::Ads::GoogleAds::Errors::GoogleAdsError`, logs error for monitoring

**Create**: `rails_app/app/workers/google_ads/sync_performance_worker.rb`

- Iterates `AdsAccount.where(platform: "google")` with valid `google_customer_id`
- Calls `CampaignPerformance#fetch_daily_metrics` with **7-day rolling window** (captures late-arriving conversions)
- Upserts results into `ad_performance_daily` (idempotent - same campaign+date replaces previous values)

**Why 7-day window**: Google Ads conversions have attribution lag - a conversion today might be attributed to a click from 3 days ago. By re-fetching the last 7 days on each sync, we capture these late-arriving conversions without manual backfills.

**Create**: `rails_app/spec/support/google_ads_mocks.rb` - Test helpers for mocking search_stream API

```ruby
# spec/support/google_ads_mocks.rb
module GoogleAdsMocks
  def mock_metrics_resource(
    impressions: 0,
    clicks: 0,
    ctr: 0.0,
    cost_micros: 0,
    conversions: 0.0,
    conversions_value: 0.0,
    conversions_value_per_cost: 0.0
  )
    metrics = instance_double(Google::Ads::GoogleAds::V19::Common::Metrics)
    allow(metrics).to receive(:impressions).and_return(impressions)
    allow(metrics).to receive(:clicks).and_return(clicks)
    allow(metrics).to receive(:ctr).and_return(ctr)
    allow(metrics).to receive(:cost_micros).and_return(cost_micros)
    allow(metrics).to receive(:conversions).and_return(conversions)
    allow(metrics).to receive(:conversions_value).and_return(conversions_value)
    allow(metrics).to receive(:conversions_value_per_cost).and_return(conversions_value_per_cost)
    metrics
  end

  def mock_segments_resource(date: "2024-01-01")
    segments = instance_double(Google::Ads::GoogleAds::V19::Common::Segments)
    allow(segments).to receive(:date).and_return(date)
    segments
  end

  def mock_campaign_resource(id:, name:)
    campaign = instance_double(Google::Ads::GoogleAds::V19::Resources::Campaign)
    allow(campaign).to receive(:id).and_return(id)
    allow(campaign).to receive(:name).and_return(name)
    campaign
  end

  def mock_search_stream_response_with_campaign_performance(rows_data, customer_id: 456)
    rows = rows_data.map do |data|
      row = instance_double(Google::Ads::GoogleAds::V19::Services::GoogleAdsRow)
      allow(row).to receive(:campaign).and_return(
        mock_campaign_resource(id: data[:campaign_id], name: data[:campaign_name])
      )
      allow(row).to receive(:segments).and_return(
        mock_segments_resource(date: data[:date])
      )
      allow(row).to receive(:metrics).and_return(
        mock_metrics_resource(
          impressions: data[:impressions] || 0,
          clicks: data[:clicks] || 0,
          ctr: data[:ctr] || (data[:clicks].to_f / [data[:impressions], 1].max),
          cost_micros: data[:cost_micros] || 0,
          conversions: data[:conversions] || 0.0,
          conversions_value: data[:conversions_value] || 0.0,
          conversions_value_per_cost: data[:conversions_value_per_cost] || 0.0
        )
      )
      row
    end

    response = instance_double(Google::Ads::GoogleAds::V19::Services::SearchGoogleAdsStreamResponse)
    allow(response).to receive(:results).and_return(rows)

    client = instance_double(Google::Ads::GoogleAds::Services::V19::GoogleAdsService::Client)
    allow(client).to receive(:search_stream).and_yield(response)

    allow_any_instance_of(GoogleAds::Client).to receive(:service)
      .and_return(double(google_ads: client))
  end

  def mock_empty_search_stream_response
    response = instance_double(Google::Ads::GoogleAds::V19::Services::SearchGoogleAdsStreamResponse)
    allow(response).to receive(:results).and_return([])

    client = instance_double(Google::Ads::GoogleAds::Services::V19::GoogleAdsService::Client)
    allow(client).to receive(:search_stream).and_yield(response)

    allow_any_instance_of(GoogleAds::Client).to receive(:service)
      .and_return(double(google_ads: client))
  end

  def mock_search_stream_multi_batch_response(batches_data, customer_id: 456)
    # For testing streaming responses with multiple batches
    responses = batches_data.map do |batch|
      rows = batch.map do |data|
        row = instance_double(Google::Ads::GoogleAds::V19::Services::GoogleAdsRow)
        allow(row).to receive(:campaign).and_return(
          mock_campaign_resource(id: data[:campaign_id], name: data[:campaign_name])
        )
        allow(row).to receive(:segments).and_return(
          mock_segments_resource(date: data[:date])
        )
        allow(row).to receive(:metrics).and_return(
          mock_metrics_resource(
            impressions: data[:impressions] || 0,
            clicks: data[:clicks] || 0,
            cost_micros: data[:cost_micros] || 0,
            conversions: data[:conversions] || 0.0,
            conversions_value: data[:conversions_value] || 0.0
          )
        )
        row
      end

      response = instance_double(Google::Ads::GoogleAds::V19::Services::SearchGoogleAdsStreamResponse)
      allow(response).to receive(:results).and_return(rows)
      response
    end

    client = instance_double(Google::Ads::GoogleAds::Services::V19::GoogleAdsService::Client)
    allow(client).to receive(:search_stream) do |&block|
      responses.each { |r| block.call(r) }
    end

    allow_any_instance_of(GoogleAds::Client).to receive(:service)
      .and_return(double(google_ads: client))
  end
end

RSpec.configure do |config|
  config.include GoogleAdsMocks, type: :worker
  config.include GoogleAdsMocks, google_ads: true
end
```

**Usage example** in worker spec:

```ruby
# spec/workers/google_ads/sync_performance_worker_spec.rb
RSpec.describe GoogleAds::SyncPerformanceWorker do
  include GoogleAdsMocks

  let(:ads_account) { create(:ads_account, platform: "google", google_customer_id: "123-456-7890") }
  let(:campaign) { create(:campaign, ads_account: ads_account, google_campaign_id: "111222333") }

  context "with valid Google Ads connection" do
    before do
      mock_search_stream_response_with_campaign_performance([
        {
          campaign_id: campaign.google_campaign_id.to_i,
          campaign_name: campaign.name,
          date: Date.yesterday.strftime("%Y-%m-%d"),
          impressions: 1000,
          clicks: 50,
          cost_micros: 25_000_000,
          conversions: 5.0,
          conversions_value: 500.0
        }
      ], customer_id: ads_account.google_customer_id.delete("-").to_i)
    end

    it "creates ad_performance_daily record" do
      expect { subject.perform }.to change(AdPerformanceDaily, :count).by(1)
    end
  end

  context "with empty response" do
    before { mock_empty_search_stream_response }

    it "completes without creating records" do
      expect { subject.perform }.not_to change(AdPerformanceDaily, :count)
    end
  end
end
```

### Step 6: Schedule Workers

**Modify**: `rails_app/schedule.rb`

```ruby
category "Analytics" do
  every(1.hour, "compute daily metrics") do
    Analytics::ComputeDailyMetricsWorker.perform_async
  end

  every(1.day, "backfill analytics (2 days)", at: "04:00") do
    2.times { |i| Analytics::ComputeDailyMetricsWorker.perform_async((Date.current - (i+1).days).iso8601) }
  end
end

# Add to existing "Google Ads" category:
every(6.hours, "sync google ads performance (7-day rolling)") do
  GoogleAds::SyncPerformanceWorker.perform_async
end
```

### Step 7: Controller and Route

**Modify**: `rails_app/app/controllers/dashboard_controller.rb` (replace existing empty one)

```ruby
class DashboardController < SubscribedController
  def show
    service = Analytics::DashboardService.new(
      current_account,
      days: params[:days]&.to_i || 30,
      status_filter: params[:status] || "all"
    )

    render inertia: "Dashboard", props: {
      performance: service.performance_overview,
      projects: service.projects_summary,
      date_range: service.date_range_label,
      available_date_ranges: Analytics::DashboardService::DATE_RANGES
    }
  end
end
```

**Modify**: `rails_app/config/routes/subscribed.rb` - Add inside `authenticated :user` block:

```ruby
get :dashboard, to: "dashboard#show"
```

### Step 8: Install Recharts

```bash
cd rails_app && pnpm add recharts
```

Recharts: React-native, declarative JSX, lightweight (~60KB gzipped), excellent time-series line chart support, React 19 compatible.

### Step 9: Frontend Components

**Create**:

```
rails_app/app/javascript/frontend/
  pages/
    Dashboard.tsx                      # Main page (replaces or renames existing)
  components/
    dashboard/
      PerformanceOverview.tsx          # 4 charts in a 2x2 grid
      MetricChart.tsx                  # Reusable Recharts line chart
      DateRangeFilter.tsx              # Dropdown for date range selection
      ProjectsTable.tsx                # Projects list with stats
      ProjectStatusTabs.tsx            # All/Live/Paused/Draft filter tabs
      TrendIndicator.tsx              # Arrow icon + percentage text
```

#### Data flow:

1. User visits `/dashboard` or changes date filter
2. Inertia `router.get("/dashboard", { days: 30 }, { preserveState: true, preserveScroll: true })` triggers reload
3. `DashboardController#show` computes all props via `DashboardService` (cache-backed)
4. React `Dashboard` page renders Recharts charts with multi-project series
5. Projects table shows per-project stats with status tab filtering (client-side filter)

#### MetricChart component:

- Uses Recharts `LineChart`, `Line`, `ResponsiveContainer`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`
- Multi-series: one `<Line>` per project with distinct colors
- When `available: false`: shows placeholder message instead of chart
- Responsive: fills container width, fixed 200px height

#### DateRangeFilter:

- Uses existing `native-select` or `select` UI component
- On change: `router.get("/dashboard", { days: selectedDays })`

#### ProjectsTable:

- Shows project thumbnail, name, status badge, URL, stats columns (Leads, Page Views, CTR, CPL, Total Ad Spend)
- Status tabs filter client-side (All/Live/Paused/Draft)
- Matches the design's card-based project rows

### Step 10: Backfill Rake Task

**Create**: `rails_app/lib/tasks/analytics.rake`

```ruby
namespace :analytics do
  task backfill: :environment do
    (90.days.ago.to_date..Date.yesterday).each do |date|
      Analytics::ComputeDailyMetricsWorker.new.perform(date.iso8601)
    end
  end
end
```

### Step 11: Navigation

Add dashboard link to the sidebar navigation component (the home icon in the left sidebar shown in the design).

---

## Key Insights Implementation Steps

### Step 12: Insights Database Migration

**Create**: `rails_app/db/migrate/XXXXXX_create_dashboard_insights.rb`

```ruby
create_table :dashboard_insights do |t|
  t.bigint :account_id, null: false
  t.jsonb :insights, null: false, default: []
  t.jsonb :metrics_summary                      # Snapshot of metrics used to generate
  t.datetime :generated_at, null: false
  t.timestamps
end
add_index :dashboard_insights, :account_id, unique: true
add_foreign_key :dashboard_insights, :accounts
```

### Step 13: Insights Rails Model

**Create**: `rails_app/app/models/dashboard_insight.rb`

```ruby
class DashboardInsight < ApplicationRecord
  belongs_to :account

  FRESHNESS_DURATION = 24.hours

  validates :insights, presence: true
  validates :generated_at, presence: true

  def fresh?
    generated_at > FRESHNESS_DURATION.ago
  end

  def stale?
    !fresh?
  end
end
```

### Step 14: Insights Metrics Service

**Create**: `rails_app/app/services/analytics/insights_metrics_service.rb`

Extracts a compact metrics summary for the LLM from the dashboard data:

```ruby
module Analytics
  class InsightsMetricsService
    def initialize(dashboard_service)
      @dashboard = dashboard_service
    end

    def summary
      {
        date_range: @dashboard.date_range_label,
        totals: extract_totals,
        projects: extract_project_summaries,
        trends: extract_trends
      }
    end

    private

    def extract_totals
      perf = @dashboard.performance_overview
      {
        leads: perf[:leads][:totals],
        page_views: perf[:page_views][:totals],
        ctr: perf[:ctr][:totals],
        cpl: perf[:cpl][:totals]
      }
    end

    def extract_project_summaries
      @dashboard.projects_summary.map do |p|
        {
          uuid: p[:uuid], name: p[:name], status: p[:status],
          leads: p[:total_leads], page_views: p[:total_page_views],
          ctr: p[:ctr], cpl: p[:cpl_dollars], spend: p[:total_spend_dollars]
        }
      end
    end

    def extract_trends
      perf = @dashboard.performance_overview
      {
        leads_trend: perf[:leads][:totals][:trend_percent],
        page_views_trend: perf[:page_views][:totals][:trend_percent],
        ctr_trend: perf[:ctr][:totals][:trend_percent],
        cpl_trend: perf[:cpl][:totals][:trend_percent]
      }
    end
  end
end
```

### Step 15: Update DashboardController for Insights

**Modify**: `rails_app/app/controllers/dashboard_controller.rb`

```ruby
class DashboardController < SubscribedController
  def show
    service = Analytics::DashboardService.new(
      current_account,
      days: params[:days]&.to_i || 30,
      status_filter: params[:status] || "all"
    )

    insight_record = current_account.dashboard_insight

    # Force regeneration if requested
    if params[:regenerate_insights] && insight_record
      insight_record.update!(generated_at: 100.years.ago)
      insight_record = nil
    end

    render inertia: "Dashboard", props: {
      performance: service.performance_overview,
      projects: service.projects_summary,
      date_range: service.date_range_label,
      available_date_ranges: Analytics::DashboardService::DATE_RANGES,

      # Insights props
      insights: insight_record&.fresh? ? insight_record.insights : nil,
      insights_generated_at: insight_record&.generated_at,
      metrics_summary: insight_record&.fresh? ? nil : Analytics::InsightsMetricsService.new(service).summary
    }
  end
end
```

### Step 16: Langgraph Insights Annotation

**Create**: `langgraph_app/app/annotation/insightsAnnotation.ts`

```typescript
import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import { createAppBridge } from "@api/middleware";
import { z } from "zod";

// Input: metrics summary from Rails
export const metricsSummarySchema = z.object({
  date_range: z.string(),
  totals: z.object({
    leads: z.object({ current: z.number(), trend_percent: z.number().nullable() }),
    page_views: z.object({ current: z.number(), trend_percent: z.number().nullable() }),
    ctr: z.object({ current: z.number().nullable(), trend_percent: z.number().nullable(), available: z.boolean() }),
    cpl: z.object({ current: z.number().nullable(), trend_percent: z.number().nullable(), available: z.boolean() }),
  }),
  projects: z.array(z.object({
    uuid: z.string(),
    name: z.string(),
    status: z.string(),
    leads: z.number(),
    page_views: z.number(),
    ctr: z.number().nullable(),
    cpl: z.number().nullable(),
    spend: z.number().nullable(),
  })),
  trends: z.object({
    leads_trend: z.number().nullable(),
    page_views_trend: z.number().nullable(),
    ctr_trend: z.number().nullable(),
    cpl_trend: z.number().nullable(),
  }),
});
export type MetricsSummary = z.infer<typeof metricsSummarySchema>;

// Output: generated insights
export const insightSchema = z.object({
  title: z.string(),
  description: z.string(),
  sentiment: z.enum(["positive", "negative", "neutral"]),
  metric_type: z.enum(["leads", "page_views", "ctr", "cpl", "spend"]),
  project_uuid: z.string().optional(),
  action_label: z.string().optional(),
  action_url: z.string().optional(),
});
export type Insight = z.infer<typeof insightSchema>;

export const insightsOutputSchema = z.object({
  insights: z.array(insightSchema).length(3),
});

export const InsightsAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,
  metricsSummary: Annotation<MetricsSummary | undefined>(),
  insights: Annotation<Insight[]>({
    default: () => [],
    reducer: (current, next) => next,
  }),
  status: Annotation<"pending" | "generating" | "completed" | "error">({
    default: () => "pending",
    reducer: (current, next) => next,
  }),
});

const insightsMessageSchema = z.object({
  type: z.literal("insights_generated"),
  insights: z.array(insightSchema),
});

export const InsightsBridge = createAppBridge({
  endpoint: "/api/insights/stream",
  stateAnnotation: InsightsAnnotation,
  messageSchema: [insightsMessageSchema],
  jsonTarget: "messages",
});
```

**Modify**: `langgraph_app/app/annotation/index.ts` - add export

### Step 17: Langgraph Insights Node

**Create**: `langgraph_app/app/nodes/insights/generateInsights.ts`

```typescript
import { NodeMiddleware } from "@middleware";
import { getLLM } from "@core";
import { type InsightsAnnotation, insightsOutputSchema, type Insight } from "@annotation";
import { db, dashboardInsights as insightsTable } from "@db";
import { AIMessage } from "@langchain/core/messages";

const INSIGHTS_PROMPT = `You are an analytics advisor for a marketing landing page platform.

Analyze the following metrics summary and generate exactly 3 key insights for the user.

<metrics_summary>
{metrics_summary}
</metrics_summary>

<guidelines>
- Each insight should be actionable and specific
- Include actual numbers from the data (e.g., "4.2% CTR", "$28 per lead", "down 18%")
- Focus on the most important changes or issues
- One insight can be positive (celebration/momentum), one can be an alert/concern, one can be a suggestion
- Keep titles short (3-5 words)
- Keep descriptions to 1-2 sentences max
- If a project is underperforming relative to others, call it out by name
- If Google Ads data is unavailable (ctr/cpl not available), focus on leads and page views
</guidelines>

Return exactly 3 insights.`;

export const generateInsights = NodeMiddleware.use(
  {},
  async (state: typeof InsightsAnnotation.State, config) => {
    const { metricsSummary, accountId } = state;

    if (!metricsSummary || !accountId) {
      return { status: "error" as const, error: { message: "Missing required state" } };
    }

    const llm = await getLLM({});
    const structuredLLM = llm.withStructuredOutput(insightsOutputSchema);

    const prompt = INSIGHTS_PROMPT.replace("{metrics_summary}", JSON.stringify(metricsSummary, null, 2));
    const result = await structuredLLM.invoke(prompt, config);
    const insights: Insight[] = result.insights;

    // Save to database (upsert - one record per account)
    await db
      .insert(insightsTable)
      .values({ accountId, insights, metricsSummary, generatedAt: new Date() })
      .onConflictDoUpdate({
        target: [insightsTable.accountId],
        set: { insights, metricsSummary, generatedAt: new Date(), updatedAt: new Date() },
      });

    return {
      insights,
      status: "completed" as const,
      messages: [new AIMessage({ content: JSON.stringify({ type: "insights_generated", insights }) })],
    };
  }
);
```

**Create**: `langgraph_app/app/nodes/insights/index.ts` - export node

### Step 18: Langgraph Insights Graph

**Create**: `langgraph_app/app/graphs/insights.ts`

```typescript
import { StateGraph, START, END } from "@langchain/langgraph";
import { InsightsAnnotation } from "@annotation";
import { generateInsights } from "@nodes";
import { withCreditExhaustion } from "./shared";

export const insightsGraph = withCreditExhaustion(
  new StateGraph(InsightsAnnotation)
    .addNode("generateInsights", generateInsights)
    .addEdge(START, "generateInsights")
    .addEdge("generateInsights", END),
  InsightsAnnotation
);
```

**Modify**: `langgraph_app/app/graphs/index.ts` - add export

### Step 19: Langgraph Insights API

**Create**: `langgraph_app/app/api/insights.ts`

```typescript
import { graphParams } from "@core";
import { insightsGraph } from "@graphs";
import { InsightsBridge } from "@annotation";

const compiledGraph = insightsGraph.compile({ ...graphParams, name: "insights" });

export const InsightsAPI = InsightsBridge.bind(compiledGraph);
export { InsightsBridge } from "@annotation";
```

**Modify**: `langgraph_app/app/api/index.ts` - add export

### Step 20: Langgraph Insights Route

**Create**: `langgraph_app/app/server/routes/insights.ts`

```typescript
import { Hono } from "hono";
import { type AuthContext, streamMiddleware, getCreditState } from "@server/middleware";
import { InsightsAPI } from "@api";

type Variables = { auth: AuthContext };

export const insightsRoutes = new Hono<{ Variables: Variables }>();

insightsRoutes.post("/stream", ...streamMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const creditState = getCreditState(c);
  const body = await c.req.json();

  const { threadId, state } = body;

  if (!threadId) return c.json({ error: "Missing required field: threadId" }, 400);
  if (!state?.metricsSummary) return c.json({ error: "Missing required field: state.metricsSummary" }, 400);

  return InsightsAPI.stream({
    messages: [],
    threadId,
    state: { threadId, jwt: auth.jwt, ...creditState, ...state },
  });
});

insightsRoutes.get("/health", (c) => {
  return c.json({ status: "ok", graph: "insights", timestamp: new Date().toISOString() });
});
```

**Modify**: `langgraph_app/server.ts` - register route: `app.route("/api/insights", insightsRoutes);`

### Step 21: Frontend Insights Hook

**Create**: `rails_app/app/javascript/frontend/hooks/useInsightsInit.ts`

```typescript
import { useEffect, useEffectEvent, useRef } from "react";
import { usePage } from "@inertiajs/react";
import { useLanggraph, useChatOptions } from "./";
import type { DashboardProps } from "@pages/Dashboard";

export function useInsightsInit() {
  const { insights, metrics_summary } = usePage<DashboardProps>().props;
  const needsGeneration = !insights && metrics_summary;
  const isGenerating = useRef(false);

  const options = useChatOptions({ apiPath: "api/insights/stream" });
  const chat = useLanggraph(options);

  const maybeGenerate = useEffectEvent(async () => {
    if (!needsGeneration) return;
    if (isGenerating.current) return;

    isGenerating.current = true;

    try {
      await chat.actions.updateState({ metricsSummary: metrics_summary });
    } finally {
      isGenerating.current = false;
    }
  });

  useEffect(() => { maybeGenerate(); }, [needsGeneration]);

  return { insights, isGenerating: !insights && needsGeneration, chat };
}
```

### Step 22: Frontend Insights Component

**Create**: `rails_app/app/javascript/frontend/components/dashboard/KeyInsights.tsx`

```typescript
import { usePage, router } from "@inertiajs/react";
import { Sparkles, ArrowRight, RefreshCw } from "lucide-react";
import { cn } from "@utils";
import { useInsightsInit } from "@hooks";
import type { DashboardProps } from "@pages/Dashboard";

type Insight = {
  title: string;
  description: string;
  sentiment: "positive" | "negative" | "neutral";
  metric_type: string;
  project_uuid?: string;
  action_label?: string;
  action_url?: string;
};

const sentimentColors = {
  positive: "border-green-200 bg-green-50",
  negative: "border-amber-200 bg-amber-50",
  neutral: "border-purple-200 bg-purple-50",
};

const sentimentTitleColors = {
  positive: "text-green-700",
  negative: "text-amber-700",
  neutral: "text-purple-700",
};

function InsightCard({ insight }: { insight: Insight }) {
  const handleReview = () => {
    if (insight.action_url) router.visit(insight.action_url);
    else if (insight.project_uuid) router.visit(`/projects/${insight.project_uuid}/website`);
  };

  return (
    <div className={cn("rounded-lg border p-4 flex flex-col gap-2", sentimentColors[insight.sentiment])}>
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <h3 className={cn("font-medium", sentimentTitleColors[insight.sentiment])}>{insight.title}</h3>
      </div>
      <p className="text-sm text-gray-600">{insight.description}</p>
      <button
        onClick={handleReview}
        className="self-end flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mt-2"
      >
        {insight.action_label || "Review"} <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function InsightSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-4 h-4 bg-gray-200 rounded" />
        <div className="h-5 bg-gray-200 rounded w-32" />
      </div>
      <div className="h-4 bg-gray-200 rounded w-full mb-1" />
      <div className="h-4 bg-gray-200 rounded w-3/4" />
    </div>
  );
}

export function KeyInsights() {
  const { insights_generated_at } = usePage<DashboardProps>().props;
  const { insights, isGenerating } = useInsightsInit();

  const handleRegenerate = () => {
    router.visit(window.location.pathname, { data: { regenerate_insights: true }, preserveState: true });
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Key Insights</h2>
        {insights && (
          <button onClick={handleRegenerate} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <RefreshCw className="w-4 h-4" /> Regenerate
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isGenerating ? (
          <><InsightSkeleton /><InsightSkeleton /><InsightSkeleton /></>
        ) : insights ? (
          insights.map((insight, i) => <InsightCard key={i} insight={insight} />)
        ) : (
          <p className="text-gray-500 col-span-3">No insights available.</p>
        )}
      </div>
    </section>
  );
}
```

### Step 23: Update Dashboard Page for Insights

**Modify**: `rails_app/app/javascript/frontend/pages/Dashboard.tsx`

```typescript
import { KeyInsights } from "@components/dashboard/KeyInsights";
// ... existing imports

export type DashboardProps = {
  performance: PerformanceData;
  projects: ProjectSummary[];
  date_range: string;
  available_date_ranges: DateRange[];
  insights: Insight[] | null;
  insights_generated_at: string | null;
  metrics_summary: MetricsSummary | null;
};

export default function Dashboard() {
  return (
    <Layout>
      <KeyInsights />
      <PerformanceOverview />
      <ProjectsTable />
    </Layout>
  );
}
```

---

## Projects Summary Query

Single aggregated query for the projects table (no N+1):

```ruby
AnalyticsDailyMetric
  .where(account_id: @account.id, date: @start_date..@end_date)
  .joins("INNER JOIN projects ON projects.id = analytics_daily_metrics.project_id")
  .joins("INNER JOIN websites ON websites.project_id = projects.id")
  .group("projects.id", "projects.name", "projects.uuid", "websites.status")
  .select(
    "projects.id", "projects.name", "projects.uuid",
    "websites.status as website_status",
    "SUM(leads_count) as total_leads",
    "SUM(page_views_count) as total_page_views",
    "SUM(clicks)::float / NULLIF(SUM(impressions), 0) as ctr",
    "SUM(cost_micros)::float / NULLIF(SUM(leads_count), 0) / 1000000.0 as cpl_dollars",
    "SUM(cost_micros) / 1000000.0 as total_spend_dollars"
  )
```

Enriched with project status, website URL, and thumbnail metadata.

---

## Caching Architecture

```
Request -> DashboardController -> DashboardService
                                       |
                                 CacheService.fetch(metric_key)
                                       |
                                 Rails.cache.fetch (15min TTL, Solid Cache)
                                       | (cache miss)
                                 Merge(pre-computed, live_today)
                                       |
                                 Pre-computed: analytics_daily_metrics WHERE date < today
                                 Live today:   source tables WHERE date = today
```

Cache key: `analytics/{account_id}/{metric}/{days}/{15min_bucket}`

---

## Files Summary

### Rails Files to Create

| File                                                        | Purpose                                     |
| ----------------------------------------------------------- | ------------------------------------------- |
| `db/migrate/*_create_analytics_daily_metrics.rb`            | Pre-computed rollup table                   |
| `db/migrate/*_create_ad_performance_daily.rb`               | Raw Google Ads daily data                   |
| `db/migrate/*_create_dashboard_insights.rb`                 | Cached AI insights table                    |
| `app/models/analytics_daily_metric.rb`                      | Rollup model with scopes + computed methods |
| `app/models/ad_performance_daily.rb`                        | Ad performance model                        |
| `app/models/dashboard_insight.rb`                           | Insights model with freshness check         |
| `app/services/analytics/dashboard_service.rb`               | Orchestrator for all dashboard data         |
| `app/services/analytics/cache_service.rb`                   | Cache key management + merge logic          |
| `app/services/analytics/metrics/leads_metric.rb`            | Leads time series                           |
| `app/services/analytics/metrics/page_views_metric.rb`       | Page views time series                      |
| `app/services/analytics/metrics/google_ads_metric.rb`       | CTR/CPL/spend with graceful degradation     |
| `app/services/analytics/insights_metrics_service.rb`        | Extracts metrics summary for LLM            |
| `app/workers/analytics/compute_daily_metrics_worker.rb`     | Hourly pre-computation                      |
| `app/services/google_ads/resources/campaign_performance.rb` | GAQL reporting query via search_stream      |
| `app/workers/google_ads/sync_performance_worker.rb`         | Sync ad metrics every 6h                    |
| `spec/support/google_ads_mocks.rb`                          | Test helpers for mocking search_stream API  |
| `app/javascript/frontend/pages/Dashboard.tsx`               | Main React page                             |
| `app/javascript/frontend/components/dashboard/*.tsx`        | Chart/UI components (7 files incl. KeyInsights) |
| `app/javascript/frontend/hooks/useInsightsInit.ts`          | Auto-generation hook for insights           |
| `lib/tasks/analytics.rake`                                  | Backfill task                               |

### Langgraph Files to Create

| File                                          | Purpose                              |
| --------------------------------------------- | ------------------------------------ |
| `app/annotation/insightsAnnotation.ts`        | State annotation + bridge            |
| `app/nodes/insights/generateInsights.ts`      | LLM generation node                  |
| `app/nodes/insights/index.ts`                 | Node exports                         |
| `app/graphs/insights.ts`                      | Graph definition                     |
| `app/api/insights.ts`                         | Compiled API                         |
| `app/server/routes/insights.ts`               | Hono route                           |

### Files to Modify

| File                                      | Change                                                  |
| ----------------------------------------- | ------------------------------------------------------- |
| `app/controllers/dashboard_controller.rb` | Replace empty controller with analytics + insights      |
| `config/routes/subscribed.rb`             | Add `get :dashboard` route                              |
| `schedule.rb`                             | Add Analytics compute + Google Ads sync schedules       |
| Sidebar navigation component              | Add dashboard link                                      |
| `langgraph_app/app/annotation/index.ts`   | Export InsightsAnnotation                               |
| `langgraph_app/app/nodes/index.ts`        | Export insights nodes                                   |
| `langgraph_app/app/graphs/index.ts`       | Export insightsGraph                                    |
| `langgraph_app/app/api/index.ts`          | Export InsightsAPI                                      |
| `langgraph_app/server.ts`                 | Register insights route                                 |

---

## Verification Plan

### Analytics Data Pipeline
1. **Migrations**: `bundle exec rake db:migrate` - verify all 3 tables exist (`analytics_daily_metrics`, `ad_performance_daily`, `dashboard_insights`)
2. **Pre-computation**: Run `Analytics::ComputeDailyMetricsWorker.new.perform(Date.yesterday.iso8601)` in console, verify `AnalyticsDailyMetric` rows created
3. **Cache**: Visit `/dashboard`, then check `Rails.cache.read("analytics/...")` returns data; wait 15 min and verify cache expires
4. **Dashboard page**: Visit `/dashboard`, confirm charts render with leads + page views data
5. **Date filter**: Change date range dropdown, confirm charts update with correct date range
6. **Graceful degradation**: With no Google Ads connected, confirm CTR/CPL charts show placeholder message
7. **Projects table**: Confirm all projects listed with correct stats; status tab filtering works
8. **Google Ads sync** (after spike): Run `GoogleAds::SyncPerformanceWorker.new.perform(ads_account.id)` and verify `AdPerformanceDaily` rows created, then verify CTR/CPL charts populate
9. **Backfill**: Run `rake analytics:backfill` and verify 90 days of historical data

### Key Insights
10. **Langgraph health**: `curl http://localhost:4300/api/insights/health` returns `{"status":"ok","graph":"insights"}`
11. **Manual generation**: In browser, visit `/dashboard` with no existing insights - verify:
    - Loading skeletons appear
    - LLM generates 3 insights
    - Insights display with correct colors/sentiment
    - Database record created in `dashboard_insights`
12. **Cache hit**: Refresh `/dashboard` - verify insights load instantly from props (no LLM call)
13. **Regeneration**: Click "Regenerate" button - verify new insights generated
14. **Credit tracking**: Check `llm_usage` table has a record for the insights generation
15. **Review action**: Click "Review →" on an insight - verify navigation to correct project page

### Tests
16. **Tests**: RSpec for `DashboardService`, each metric class, workers, controller, and `DashboardInsight` model

---

## Parallel Work Decomposition

This plan can be executed by **3 engineers working in parallel** across these tracks:

### Track A: Rails Backend (Steps 1-7, 10, 12-15)
**Owner**: Rails-focused engineer
**Focus**: Data pipeline, models, services, workers, controller

| Phase | Steps | Description | Deliverables |
|-------|-------|-------------|--------------|
| A1    | 1-2   | Database foundation | Migrations + models for `analytics_daily_metrics`, `ad_performance_daily`, `dashboard_insights` |
| A2    | 3     | Service layer | `DashboardService`, `CacheService`, metric classes (leads, page_views, google_ads) |
| A3    | 4-6   | Workers + scheduling | `ComputeDailyMetricsWorker`, Google Ads sync, schedule.rb changes |
| A4    | 7     | Controller + route | `DashboardController#show` with Inertia props |
| A5    | 10    | Backfill task | `analytics.rake` for historical data |
| A6    | 12-15 | Insights Rails side | `DashboardInsight` model, `InsightsMetricsService`, controller insights props |

**Blocking dependencies**:
- Track B needs A4 complete (controller props) before frontend integration
- Track C needs A6 complete (insights props) before frontend hook works

**Estimated scope**: ~60% of total effort

---

### Track B: Frontend Dashboard UI (Steps 8-9, 11)
**Owner**: React/Frontend engineer
**Focus**: Charts, components, page structure

| Phase | Steps | Description | Deliverables |
|-------|-------|-------------|--------------|
| B1    | 8     | Install Recharts | `pnpm add recharts` |
| B2    | 9     | Dashboard components | `Dashboard.tsx`, `PerformanceOverview.tsx`, `MetricChart.tsx`, `DateRangeFilter.tsx`, `ProjectsTable.tsx`, `ProjectStatusTabs.tsx`, `TrendIndicator.tsx` |
| B3    | 11    | Navigation | Sidebar dashboard link |

**Can start immediately**: Build components with mock data
**Integration point**: Connect to real props once Track A delivers A4

**Estimated scope**: ~20% of total effort

---

### Track C: Langgraph Insights (Steps 16-23)
**Owner**: Langgraph/TypeScript engineer
**Focus**: Insights graph, API, frontend hook

| Phase | Steps | Description | Deliverables |
|-------|-------|-------------|--------------|
| C1    | 16-17 | Annotation + node | `insightsAnnotation.ts`, `generateInsights.ts` |
| C2    | 18-20 | Graph + API + route | `insights.ts` graph, API, Hono route |
| C3    | 21-23 | Frontend integration | `useInsightsInit.ts`, `KeyInsights.tsx`, Dashboard integration |

**Can start immediately**: Build Langgraph components (annotation, node, graph, route)
**Integration point**: Frontend hook needs Track A's insights props (A6)

**Estimated scope**: ~20% of total effort

---

### Execution Timeline

```
Week 1:
┌─────────────────────────────────────────────────────────────────────┐
│ Track A: A1 (migrations) → A2 (services)                           │
│ Track B: B1 (recharts) → B2 (components with mock data)            │
│ Track C: C1 (annotation/node) → C2 (graph/API/route)               │
└─────────────────────────────────────────────────────────────────────┘

Week 2:
┌─────────────────────────────────────────────────────────────────────┐
│ Track A: A3 (workers) → A4 (controller) → A5 (backfill)            │
│ Track B: B2 (continue) → B3 (nav) → INTEGRATE with A4              │
│ Track C: C3 (frontend hook/component) → INTEGRATE with A6          │
└─────────────────────────────────────────────────────────────────────┘

Week 2-3:
┌─────────────────────────────────────────────────────────────────────┐
│ Track A: A6 (insights Rails side) → UNBLOCK Track C                │
│ All tracks: Integration testing, verification plan, bug fixes      │
└─────────────────────────────────────────────────────────────────────┘
```

### Critical Path

The critical path runs through **Track A** since both B and C depend on it:
1. A1-A2: Database + services (required for anything to work)
2. A4: Controller (required for frontend integration)
3. A6: Insights props (required for Track C integration)

### Sync Points

**Sync 1** (End of Week 1):
- Track A has services working
- Track B has components with mock data
- Track C has Langgraph graph working standalone

**Sync 2** (Mid Week 2):
- Track A delivers controller props
- Track B integrates with real data
- Verify charts work end-to-end

**Sync 3** (End of Week 2):
- Track A delivers insights props
- Track C integrates frontend hook
- Verify insights generation end-to-end

### Interface Contracts

**Track A → Track B** (Inertia props):
```ruby
{
  performance: { leads: {...}, page_views: {...}, ctr: {...}, cpl: {...} },
  projects: [...],
  date_range: "Last 30 Days",
  available_date_ranges: [...]
}
```

**Track A → Track C** (Insights props):
```ruby
{
  insights: [...] | nil,
  insights_generated_at: DateTime | nil,
  metrics_summary: {...} | nil  # Only when insights are stale
}
```

**Track C → Track A** (Database write):
- Langgraph writes directly to `dashboard_insights` table via Drizzle
- Rails reads from same table for cache check
