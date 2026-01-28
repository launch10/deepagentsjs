# Analytics Dashboard - Individual Track Plans (TDD Focus)

This document breaks down the analytics dashboard implementation into 3 independent tracks, each with detailed TDD specifications.

---

# Track A: Rails Backend (Data Pipeline)

**Owner**: Rails-focused engineer
**Estimated effort**: ~60% of total
**Directory**: `rails_app/`

## User Outcomes

1. **Dashboard loads in <500ms** - Users see their analytics data quickly
2. **Data is accurate** - Metrics match source tables exactly
3. **Google Ads degradation is graceful** - Dashboard works without Google Ads connected
4. **Historical data available** - Users can view 90 days of history
5. **Fresh data** - Today's data reflects activity within the last 15 minutes

## Performance Constraints

| Constraint              | Target           | Why                                       |
| ----------------------- | ---------------- | ----------------------------------------- |
| Dashboard response time | <500ms (p95)     | User experience                           |
| Pre-computation worker  | <30s per account | Hourly job must complete for all accounts |
| Cache hit rate          | >95%             | Reduce database load                      |
| Projects summary query  | <100ms           | Single aggregated query, no N+1           |
| Memory per request      | <50MB            | Prevent memory bloat on shared workers    |

## What Could Go Wrong

| Risk                                | Impact                      | Mitigation                                  |
| ----------------------------------- | --------------------------- | ------------------------------------------- |
| N+1 queries in projects summary     | Slow dashboard, DB overload | Single aggregated query with joins          |
| Google Ads API rate limiting        | Missing ad data             | Exponential backoff, cache previous values  |
| Transform logic bugs                | Wrong metrics shown         | Store raw data, transforms can be replayed  |
| Pre-computation worker timeout      | Stale data                  | Batch by account, checkpoint progress       |
| Cache stampede on expiry            | DB spike                    | Jitter expiry times, stale-while-revalidate |
| Data inconsistency (race condition) | Wrong numbers shown         | Transaction isolation, idempotent upserts   |
| Large accounts (100+ projects)      | Slow queries                | Pagination, limit date range options        |

---

## Phase A1: Database Foundation

### Data Architecture Principle

**Store raw, transform later.** Raw Google Ads data goes into `ad_performance_daily` exactly as returned from the API. The `analytics_daily_metrics` table contains transformed/aggregated data that can always be recomputed from raw sources. This means:

- Bug in transform logic? Fix it and replay.
- Need a new derived metric? Compute it from raw data.
- Never need to re-fetch from Google Ads API to fix calculations.

### Steps

1. Create migration: `analytics_daily_metrics` (transformed rollup)
2. Create migration: `ad_performance_daily` (raw Google Ads data)
3. Create migration: `dashboard_insights`
4. Create models with validations and scopes

### Tests Required

**Model tests** (`spec/models/`):

```ruby
# spec/models/analytics_daily_metric_spec.rb
RSpec.describe AnalyticsDailyMetric do
  describe "validations" do
    it { should validate_presence_of(:account_id) }
    it { should validate_presence_of(:project_id) }
    it { should validate_presence_of(:date) }
    it { should validate_uniqueness_of(:date).scoped_to([:account_id, :project_id]) }
  end

  describe "associations" do
    it { should belong_to(:account) }
    it { should belong_to(:project) }
  end

  describe "scopes" do
    describe ".for_date_range" do
      it "returns metrics within the range" do
        in_range = create(:analytics_daily_metric, date: 5.days.ago)
        out_of_range = create(:analytics_daily_metric, date: 30.days.ago)

        result = described_class.for_date_range(7.days.ago, Date.current)
        expect(result).to include(in_range)
        expect(result).not_to include(out_of_range)
      end
    end

    describe ".for_account" do
      it "returns metrics for the specified account only" do
        account = create(:account)
        other_account = create(:account)
        mine = create(:analytics_daily_metric, account: account)
        theirs = create(:analytics_daily_metric, account: other_account)

        result = described_class.for_account(account)
        expect(result).to include(mine)
        expect(result).not_to include(theirs)
      end
    end
  end

  describe "computed methods" do
    let(:metric) { build(:analytics_daily_metric, clicks: 100, impressions: 1000, cost_micros: 50_000_000, leads_count: 10) }

    describe "#ctr" do
      it "calculates click-through rate" do
        expect(metric.ctr).to eq(0.10)
      end

      it "returns nil when impressions is zero" do
        metric.impressions = 0
        expect(metric.ctr).to be_nil
      end
    end

    describe "#cpl_dollars" do
      it "calculates cost per lead in dollars" do
        expect(metric.cpl_dollars).to eq(5.0) # $50 / 10 leads
      end

      it "returns nil when leads_count is zero" do
        metric.leads_count = 0
        expect(metric.cpl_dollars).to be_nil
      end
    end

    describe "#cost_dollars" do
      it "converts micros to dollars" do
        expect(metric.cost_dollars).to eq(50.0)
      end
    end
  end
end
```

```ruby
# spec/models/dashboard_insight_spec.rb
RSpec.describe DashboardInsight do
  describe "validations" do
    it { should validate_presence_of(:insights) }
    it { should validate_presence_of(:generated_at) }
  end

  describe "#fresh?" do
    it "returns true when generated within 24 hours" do
      insight = build(:dashboard_insight, generated_at: 23.hours.ago)
      expect(insight.fresh?).to be true
    end

    it "returns false when generated more than 24 hours ago" do
      insight = build(:dashboard_insight, generated_at: 25.hours.ago)
      expect(insight.fresh?).to be false
    end
  end

  describe "#stale?" do
    it "is the inverse of fresh?" do
      fresh_insight = build(:dashboard_insight, generated_at: 1.hour.ago)
      stale_insight = build(:dashboard_insight, generated_at: 25.hours.ago)

      expect(fresh_insight.stale?).to be false
      expect(stale_insight.stale?).to be true
    end
  end
end
```

### Verification

- `bundle exec rspec spec/db/migrate/` passes
- `bundle exec rspec spec/models/analytics_daily_metric_spec.rb` passes
- `bundle exec rspec spec/models/ad_performance_daily_spec.rb` passes
- `bundle exec rspec spec/models/dashboard_insight_spec.rb` passes

---

## Phase A2: Service Layer

### Steps

1. Create `Analytics::DashboardService` (orchestrator)
2. Create `Analytics::CacheService`
3. Create `Analytics::Metrics::LeadsMetric`
4. Create `Analytics::Metrics::PageViewsMetric`
5. Create `Analytics::Metrics::GoogleAdsMetric`
6. Create `Analytics::InsightsMetricsService`

### Tests Required

**Service tests** (`spec/services/analytics/`):

```ruby
# spec/services/analytics/dashboard_service_spec.rb
RSpec.describe Analytics::DashboardService do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }

  subject { described_class.new(account, days: 30, status_filter: "all") }

  describe "#performance_overview" do
    before do
      create(:analytics_daily_metric, account: account, project: project,
             date: 5.days.ago, leads_count: 10, page_views_count: 100)
    end

    it "returns leads time series" do
      result = subject.performance_overview
      expect(result[:leads]).to have_key(:dates)
      expect(result[:leads]).to have_key(:series)
      expect(result[:leads]).to have_key(:totals)
    end

    it "returns page_views time series" do
      result = subject.performance_overview
      expect(result[:page_views][:totals][:current]).to eq(100)
    end

    it "returns ctr with available flag" do
      result = subject.performance_overview
      expect(result[:ctr]).to have_key(:available)
    end

    it "returns cpl with available flag" do
      result = subject.performance_overview
      expect(result[:cpl]).to have_key(:available)
    end
  end

  describe "#projects_summary" do
    it "returns aggregated stats per project" do
      create(:analytics_daily_metric, account: account, project: project,
             date: 5.days.ago, leads_count: 10, page_views_count: 100,
             impressions: 1000, clicks: 50, cost_micros: 10_000_000)

      result = subject.projects_summary
      expect(result.first[:uuid]).to eq(project.uuid)
      expect(result.first[:total_leads]).to eq(10)
      expect(result.first[:ctr]).to eq(0.05)
    end

    it "handles projects with no metrics gracefully" do
      new_project = create(:project, account: account)
      result = subject.projects_summary

      project_result = result.find { |p| p[:uuid] == new_project.uuid }
      expect(project_result[:total_leads]).to eq(0)
    end

    it "executes as a single query (no N+1)" do
      create_list(:project, 5, account: account)

      expect {
        subject.projects_summary
      }.to make_database_queries(count: 1..3) # Allow for cache/setup queries
    end
  end

  describe "date range filtering" do
    it "respects days parameter" do
      old_metric = create(:analytics_daily_metric, account: account, project: project,
                          date: 60.days.ago, leads_count: 100)
      recent_metric = create(:analytics_daily_metric, account: account, project: project,
                             date: 5.days.ago, leads_count: 10)

      service = described_class.new(account, days: 30, status_filter: "all")
      result = service.performance_overview

      expect(result[:leads][:totals][:current]).to eq(10)
    end
  end

  describe "performance" do
    it "completes within 500ms for account with 50 projects" do
      create_list(:project, 50, account: account).each do |p|
        create(:analytics_daily_metric, account: account, project: p, date: 5.days.ago)
      end

      expect {
        subject.performance_overview
        subject.projects_summary
      }.to perform_under(500).ms
    end
  end
end
```

```ruby
# spec/services/analytics/cache_service_spec.rb
RSpec.describe Analytics::CacheService do
  let(:account) { create(:account) }

  describe ".fetch" do
    it "caches results for 15 minutes" do
      call_count = 0

      2.times do
        described_class.fetch(account.id, "leads", 30) do
          call_count += 1
          { data: "test" }
        end
      end

      expect(call_count).to eq(1)
    end

    it "uses 15-minute bucket in cache key" do
      freeze_time do
        key1 = described_class.cache_key(account.id, "leads", 30)

        travel 10.minutes
        key2 = described_class.cache_key(account.id, "leads", 30)

        travel 10.minutes # Now 20 minutes total, new bucket
        key3 = described_class.cache_key(account.id, "leads", 30)

        expect(key1).to eq(key2)
        expect(key1).not_to eq(key3)
      end
    end
  end

  describe "merge strategy" do
    it "uses pre-computed data for dates before today" do
      create(:analytics_daily_metric, account: account,
             project: create(:project, account: account),
             date: Date.yesterday, leads_count: 50)

      result = described_class.fetch_with_live_merge(account.id, "leads", 7) do |date_range|
        # This block should only be called for today's data
        expect(date_range).to eq(Date.current..Date.current)
        { Date.current => 10 }
      end

      expect(result[Date.yesterday]).to eq(50)
      expect(result[Date.current]).to eq(10)
    end
  end
end
```

```ruby
# spec/services/analytics/metrics/leads_metric_spec.rb
RSpec.describe Analytics::Metrics::LeadsMetric do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project) }

  subject { described_class.new(account, 7.days.ago, Date.current) }

  describe "#time_series" do
    before do
      create(:website_lead, website: website, created_at: 3.days.ago)
      create(:website_lead, website: website, created_at: 3.days.ago)
      create(:website_lead, website: website, created_at: 1.day.ago)
    end

    it "returns dates array" do
      result = subject.time_series
      expect(result[:dates].length).to eq(8) # 7 days + today
    end

    it "returns series grouped by project" do
      result = subject.time_series
      expect(result[:series].first[:project_name]).to eq(project.name)
      expect(result[:series].first[:data].sum).to eq(3)
    end

    it "calculates trend percentage" do
      result = subject.time_series
      expect(result[:totals]).to have_key(:trend_percent)
      expect(result[:totals]).to have_key(:trend_direction)
    end
  end

  describe "trend calculation" do
    it "shows positive trend when this week > last week" do
      # Last week: 5 leads
      5.times { create(:website_lead, website: website, created_at: 10.days.ago) }
      # This week: 10 leads
      10.times { create(:website_lead, website: website, created_at: 2.days.ago) }

      service = described_class.new(account, 14.days.ago, Date.current)
      result = service.time_series

      expect(result[:totals][:trend_direction]).to eq("up")
      expect(result[:totals][:trend_percent]).to eq(100.0) # 100% increase
    end
  end
end
```

```ruby
# spec/services/analytics/metrics/google_ads_metric_spec.rb
RSpec.describe Analytics::Metrics::GoogleAdsMetric do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:campaign) { create(:campaign, project: project) }

  subject { described_class.new(account, 7.days.ago, Date.current) }

  describe "graceful degradation" do
    context "when no ads account connected" do
      it "returns available: false" do
        result = subject.ctr_time_series
        expect(result[:available]).to be false
        expect(result[:message]).to include("Connect Google Ads")
      end
    end

    context "when no campaigns exist" do
      before { create(:ads_account, account: account) }

      it "returns available: false with appropriate message" do
        result = subject.ctr_time_series
        expect(result[:available]).to be false
      end
    end

    context "when ads data exists" do
      before do
        create(:ads_account, account: account)
        create(:ad_performance_daily, campaign: campaign,
               date: 3.days.ago, impressions: 1000, clicks: 50)
      end

      it "returns available: true with data" do
        result = subject.ctr_time_series
        expect(result[:available]).to be true
        expect(result[:series]).not_to be_empty
      end
    end
  end

  describe "#cpl_time_series" do
    before do
      create(:ads_account, account: account)
      create(:ad_performance_daily, campaign: campaign,
             date: 3.days.ago, cost_micros: 50_000_000) # $50
      create(:website_lead, website: project.website, created_at: 3.days.ago)
      create(:website_lead, website: project.website, created_at: 3.days.ago)
    end

    it "calculates cost per lead correctly" do
      result = subject.cpl_time_series
      # $50 / 2 leads = $25 CPL
      day_data = result[:series].first[:data].find { |d| d > 0 }
      expect(day_data).to eq(25.0)
    end
  end
end
```

```ruby
# spec/services/analytics/insights_metrics_service_spec.rb
RSpec.describe Analytics::InsightsMetricsService do
  let(:account) { create(:account) }
  let(:dashboard_service) { Analytics::DashboardService.new(account, days: 30, status_filter: "all") }

  subject { described_class.new(dashboard_service) }

  describe "#summary" do
    before do
      project = create(:project, account: account)
      create(:analytics_daily_metric, account: account, project: project,
             date: 5.days.ago, leads_count: 10, page_views_count: 100)
    end

    it "extracts totals for all metric types" do
      result = subject.summary
      expect(result[:totals]).to have_key(:leads)
      expect(result[:totals]).to have_key(:page_views)
      expect(result[:totals]).to have_key(:ctr)
      expect(result[:totals]).to have_key(:cpl)
    end

    it "extracts project summaries" do
      result = subject.summary
      expect(result[:projects]).to be_an(Array)
      expect(result[:projects].first).to have_key(:uuid)
      expect(result[:projects].first).to have_key(:name)
    end

    it "extracts trends" do
      result = subject.summary
      expect(result[:trends]).to have_key(:leads_trend)
      expect(result[:trends]).to have_key(:page_views_trend)
    end

    it "serializes to JSON without errors" do
      result = subject.summary
      expect { result.to_json }.not_to raise_error
    end
  end
end
```

### Verification

- `bundle exec rspec spec/services/analytics/` passes
- All service specs execute in <5s total

---

## Phase A3: Workers + Scheduling

### Steps

1. Create `Analytics::ComputeDailyMetricsWorker`
2. Create `GoogleAds::SyncPerformanceWorker` (7-day rolling window, upserts raw data)
3. Create `GoogleAds::Resources::CampaignPerformance`
4. Update `schedule.rb`

### Data Architecture

- `ad_performance_daily` stores **raw** Google Ads data - unmassaged, exactly as returned from API
- `analytics_daily_metrics` is the **transform** layer - can be recomputed from raw sources
- 7-day rolling window captures late-arriving conversions (attribution lag)

### Tests Required

```ruby
# spec/workers/analytics/compute_daily_metrics_worker_spec.rb
RSpec.describe Analytics::ComputeDailyMetricsWorker do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project) }
  let(:domain) { create(:domain, website: website) }

  describe "#perform" do
    context "with date argument" do
      let(:target_date) { Date.yesterday }

      before do
        # Create source data
        create(:website_lead, website: website, created_at: target_date.to_time)
        create(:domain_request_count, domain: domain, hour: target_date.to_time, request_count: 500)
      end

      it "creates analytics_daily_metric record" do
        expect {
          subject.perform(target_date.iso8601)
        }.to change(AnalyticsDailyMetric, :count).by(1)
      end

      it "aggregates leads correctly" do
        subject.perform(target_date.iso8601)
        metric = AnalyticsDailyMetric.last
        expect(metric.leads_count).to eq(1)
      end

      it "aggregates page views correctly" do
        subject.perform(target_date.iso8601)
        metric = AnalyticsDailyMetric.last
        expect(metric.page_views_count).to eq(500)
      end

      it "upserts on conflict (idempotent)" do
        subject.perform(target_date.iso8601)
        create(:website_lead, website: website, created_at: target_date.to_time)

        expect {
          subject.perform(target_date.iso8601)
        }.not_to change(AnalyticsDailyMetric, :count)

        metric = AnalyticsDailyMetric.last
        expect(metric.leads_count).to eq(2)
      end
    end

    context "without date argument (defaults to yesterday)" do
      it "processes yesterday's data" do
        expect(subject).to receive(:compute_for_date).with(Date.yesterday)
        subject.perform
      end
    end

    context "performance" do
      it "completes within 30 seconds for 100 accounts" do
        accounts = create_list(:account, 100)
        accounts.each do |acc|
          project = create(:project, account: acc)
          website = create(:website, project: project)
          create(:website_lead, website: website, created_at: Date.yesterday.to_time)
        end

        expect {
          subject.perform(Date.yesterday.iso8601)
        }.to perform_under(30).seconds
      end
    end

    context "error handling" do
      it "continues processing other accounts on individual failure" do
        account1 = create(:account)
        account2 = create(:account)

        allow_any_instance_of(described_class).to receive(:compute_for_account)
          .with(account1, anything).and_raise(StandardError)
        allow_any_instance_of(described_class).to receive(:compute_for_account)
          .with(account2, anything).and_call_original

        expect { subject.perform(Date.yesterday.iso8601) }.not_to raise_error
      end
    end
  end
end
```

```ruby
# spec/workers/google_ads/sync_performance_worker_spec.rb
RSpec.describe GoogleAds::SyncPerformanceWorker do
  include GoogleAdsMocks

  let(:ads_account) { create(:ads_account, platform: "google", google_customer_id: "123-456-7890") }
  let(:campaign) { create(:campaign, ads_account: ads_account, google_campaign_id: "111222333") }

  describe "#perform" do
    context "7-day rolling window" do
      it "fetches last 7 days of data" do
        expect_any_instance_of(GoogleAds::Resources::CampaignPerformance)
          .to receive(:fetch_daily_metrics)
          .with(start_date: 7.days.ago.to_date, end_date: Date.yesterday)
          .and_return([])

        subject.perform
      end
    end

    context "with valid Google Ads connection" do
      before do
        # Mock the search_stream API response with campaign performance data
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
        expect {
          subject.perform
        }.to change(AdPerformanceDaily, :count).by(1)
      end

      it "stores raw values exactly as returned from API" do
        subject.perform
        record = AdPerformanceDaily.last
        # Raw values - no transformation
        expect(record.impressions).to eq(1000)
        expect(record.clicks).to eq(50)
        expect(record.cost_micros).to eq(25_000_000)  # Not converted to dollars
        expect(record.conversions).to eq(5.0)
        expect(record.conversions_value).to eq(500.0)
      end

      it "upserts on conflict - updates existing records with new data" do
        subject.perform
        original_record = AdPerformanceDaily.last

        # Simulate late-arriving conversions in next sync
        mock_search_stream_response_with_campaign_performance([
          {
            campaign_id: campaign.google_campaign_id.to_i,
            campaign_name: campaign.name,
            date: Date.yesterday.strftime("%Y-%m-%d"),
            impressions: 1000,
            clicks: 50,
            cost_micros: 25_000_000,
            conversions: 7.0,  # 2 more conversions arrived
            conversions_value: 700.0
          }
        ], customer_id: ads_account.google_customer_id.delete("-").to_i)

        expect {
          subject.perform
        }.not_to change(AdPerformanceDaily, :count)

        original_record.reload
        expect(original_record.conversions).to eq(7.0)  # Updated with new value
      end
    end

    context "with 7-day rolling window data" do
      before do
        # Mock 7 days of data in a single batch (typical sync)
        days_data = (1..7).map do |days_ago|
          {
            campaign_id: campaign.google_campaign_id.to_i,
            campaign_name: campaign.name,
            date: days_ago.days.ago.strftime("%Y-%m-%d"),
            impressions: 1000 - (days_ago * 100),
            clicks: 50 - (days_ago * 5),
            cost_micros: 25_000_000 - (days_ago * 2_000_000),
            conversions: 5.0 - (days_ago * 0.5),
            conversions_value: 500.0 - (days_ago * 50)
          }
        end
        mock_search_stream_response_with_campaign_performance(
          days_data,
          customer_id: ads_account.google_customer_id.delete("-").to_i
        )
      end

      it "creates records for each day in the window" do
        expect {
          subject.perform
        }.to change(AdPerformanceDaily, :count).by(7)
      end
    end

    context "with empty search_stream response" do
      before do
        mock_empty_search_stream_response
      end

      it "completes without creating records" do
        expect {
          subject.perform
        }.not_to change(AdPerformanceDaily, :count)
      end
    end

    context "with Google Ads API error" do
      before do
        allow_any_instance_of(Google::Ads::GoogleAds::Services::V19::GoogleAdsService::Client)
          .to receive(:search_stream)
          .and_raise(Google::Ads::GoogleAds::Errors::GoogleAdsError.new("API Error"))
      end

      it "logs error and continues" do
        expect(Rails.logger).to receive(:error).with(/Google Ads sync failed/)
        expect { subject.perform }.not_to raise_error
      end
    end

    context "with no ads accounts" do
      it "completes without error" do
        AdsAccount.destroy_all
        expect { subject.perform }.not_to raise_error
      end
    end
  end
end
```

### Google Ads Mocking Helpers

**Create**: `spec/support/google_ads_mocks.rb`

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

### Verification

- `bundle exec rspec spec/workers/` passes
- Workers are idempotent (can run multiple times safely)
- Error handling prevents cascading failures

---

## Phase A4: Controller + Route

### Steps

1. Implement `DashboardController#show`
2. Add route in `config/routes/subscribed.rb`

### Tests Required

```ruby
# spec/controllers/dashboard_controller_spec.rb
RSpec.describe DashboardController, type: :controller do
  let(:account) { create(:account) }
  let(:user) { create(:user, account: account) }

  before { sign_in user }

  describe "GET #show" do
    it "renders the Dashboard Inertia page" do
      get :show
      expect(response).to have_http_status(:ok)
      expect(response.headers["X-Inertia"]).to be_present
    end

    it "includes performance data in props" do
      get :show
      props = JSON.parse(response.body)["props"]
      expect(props).to have_key("performance")
      expect(props["performance"]).to have_key("leads")
    end

    it "includes projects summary in props" do
      create(:project, account: account)
      get :show
      props = JSON.parse(response.body)["props"]
      expect(props["projects"]).to be_an(Array)
    end

    context "date range filtering" do
      it "defaults to 30 days" do
        get :show
        props = JSON.parse(response.body)["props"]
        expect(props["date_range"]).to eq("Last 30 Days")
      end

      it "accepts days parameter" do
        get :show, params: { days: 7 }
        props = JSON.parse(response.body)["props"]
        expect(props["date_range"]).to eq("Last 7 Days")
      end
    end

    context "insights props" do
      it "includes fresh insights when available" do
        create(:dashboard_insight, account: account,
               insights: [{ title: "Test" }], generated_at: 1.hour.ago)

        get :show
        props = JSON.parse(response.body)["props"]
        expect(props["insights"]).to be_present
        expect(props["metrics_summary"]).to be_nil
      end

      it "includes metrics_summary when insights are stale" do
        create(:dashboard_insight, account: account,
               insights: [{ title: "Test" }], generated_at: 25.hours.ago)

        get :show
        props = JSON.parse(response.body)["props"]
        expect(props["insights"]).to be_nil
        expect(props["metrics_summary"]).to be_present
      end

      it "handles regenerate_insights param" do
        insight = create(:dashboard_insight, account: account,
                        insights: [{ title: "Test" }], generated_at: 1.hour.ago)

        get :show, params: { regenerate_insights: true }
        props = JSON.parse(response.body)["props"]

        expect(props["insights"]).to be_nil
        expect(insight.reload.generated_at).to be < 1.year.ago
      end
    end

    context "performance" do
      before do
        create_list(:project, 20, account: account).each do |p|
          create(:analytics_daily_metric, account: account, project: p, date: 5.days.ago)
        end
      end

      it "responds within 500ms" do
        expect {
          get :show
        }.to perform_under(500).ms
      end
    end

    context "authorization" do
      it "requires authentication" do
        sign_out user
        get :show
        expect(response).to redirect_to(new_user_session_path)
      end

      it "requires subscription" do
        user.account.update!(subscription_status: nil)
        get :show
        expect(response).to redirect_to(pricing_path)
      end
    end
  end
end
```

### Verification

- `bundle exec rspec spec/controllers/dashboard_controller_spec.rb` passes
- `curl -I localhost:3000/dashboard` returns 302 (redirect to login) when not authenticated
- Dashboard loads in browser with valid session

---

## Phase A5: Backfill Task

### Steps

1. Create `lib/tasks/analytics.rake`

### Tests Required

```ruby
# spec/tasks/analytics_spec.rb
RSpec.describe "analytics:backfill" do
  include_context "rake"

  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project) }

  before do
    # Create historical data
    90.times do |i|
      create(:website_lead, website: website, created_at: i.days.ago)
    end
  end

  it "creates metrics for 90 days" do
    expect {
      Rake::Task["analytics:backfill"].invoke
    }.to change(AnalyticsDailyMetric, :count).by_at_least(90)
  end

  it "is idempotent" do
    Rake::Task["analytics:backfill"].invoke
    Rake::Task["analytics:backfill"].reenable

    expect {
      Rake::Task["analytics:backfill"].invoke
    }.not_to change(AnalyticsDailyMetric, :count)
  end
end
```

---

# Track B: Frontend Dashboard UI

**Owner**: React/Frontend engineer
**Estimated effort**: ~20% of total
**Directory**: `rails_app/app/javascript/frontend/`

## User Outcomes

1. **Charts are readable** - Users can understand their performance at a glance
2. **Responsive design** - Works on desktop and tablet
3. **Interactive filtering** - Date range and status filters respond immediately
4. **Loading states** - Users see feedback while data loads
5. **Accessible** - Screen readers can navigate the dashboard

## Performance Constraints

| Constraint                 | Target | Why             |
| -------------------------- | ------ | --------------- |
| First Contentful Paint     | <1.5s  | Perceived speed |
| Largest Contentful Paint   | <2.5s  | Core Web Vitals |
| Bundle size increase       | <100KB | Keep app lean   |
| Re-render on filter change | <100ms | Instant feel    |

## What Could Go Wrong

| Risk                           | Impact                   | Mitigation                           |
| ------------------------------ | ------------------------ | ------------------------------------ |
| Recharts bundle bloat          | Slow load times          | Tree-shake, lazy load charts         |
| Chart flicker on data change   | Poor UX                  | Use key prop, memoization            |
| Date filter causes full reload | Slow                     | Inertia preserveState                |
| Mobile layout broken           | Unusable on phones       | Test responsive breakpoints          |
| Color accessibility            | Can't distinguish charts | Use patterns + colors, test contrast |

---

## Phase B1: Install Recharts

### Steps

1. `pnpm add recharts`
2. Verify bundle size impact

### Tests Required

```typescript
// No tests needed - just verify installation
// Check bundle size before/after
```

### Verification

- `pnpm list recharts` shows installed version
- `pnpm run build` completes
- Bundle analyzer shows <100KB increase

---

## Phase B2: Dashboard Components

### Steps

1. Create `Dashboard.tsx` page
2. Create `PerformanceOverview.tsx`
3. Create `MetricChart.tsx`
4. Create `DateRangeFilter.tsx`
5. Create `ProjectsTable.tsx`
6. Create `ProjectStatusTabs.tsx`
7. Create `TrendIndicator.tsx`

### Tests Required

```typescript
// spec/javascript/components/dashboard/MetricChart.test.tsx
import { render, screen } from "@testing-library/react";
import { MetricChart } from "@components/dashboard/MetricChart";

describe("MetricChart", () => {
  const mockData = {
    dates: ["2026-01-01", "2026-01-02", "2026-01-03"],
    series: [
      { project_id: 1, project_name: "Project A", data: [10, 20, 15] },
      { project_id: 2, project_name: "Project B", data: [5, 8, 12] },
    ],
    totals: { current: 45, trend_percent: 12.5, trend_direction: "up" },
    available: true,
  };

  it("renders chart with data", () => {
    render(<MetricChart title="Leads" data={mockData} />);
    expect(screen.getByText("Leads")).toBeInTheDocument();
  });

  it("shows trend indicator", () => {
    render(<MetricChart title="Leads" data={mockData} />);
    expect(screen.getByText("+12.5%")).toBeInTheDocument();
  });

  it("renders placeholder when not available", () => {
    const unavailableData = { ...mockData, available: false, message: "Connect Google Ads" };
    render(<MetricChart title="CTR" data={unavailableData} />);
    expect(screen.getByText("Connect Google Ads")).toBeInTheDocument();
  });

  it("renders multiple series with different colors", () => {
    render(<MetricChart title="Leads" data={mockData} />);
    // Verify legend shows both project names
    expect(screen.getByText("Project A")).toBeInTheDocument();
    expect(screen.getByText("Project B")).toBeInTheDocument();
  });

  it("is accessible", () => {
    const { container } = render(<MetricChart title="Leads" data={mockData} />);
    // Chart should have ARIA label
    expect(container.querySelector('[role="img"]')).toHaveAttribute("aria-label");
  });
});
```

```typescript
// spec/javascript/components/dashboard/DateRangeFilter.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { DateRangeFilter } from "@components/dashboard/DateRangeFilter";
import { router } from "@inertiajs/react";

jest.mock("@inertiajs/react", () => ({
  router: { get: jest.fn() },
  usePage: () => ({ props: { date_range: "Last 30 Days" } }),
}));

describe("DateRangeFilter", () => {
  const ranges = [
    { label: "Last 7 Days", days: 7 },
    { label: "Last 30 Days", days: 30 },
    { label: "Last 90 Days", days: 90 },
  ];

  it("renders current date range", () => {
    render(<DateRangeFilter ranges={ranges} current="Last 30 Days" />);
    expect(screen.getByDisplayValue("Last 30 Days")).toBeInTheDocument();
  });

  it("calls router.get on change", () => {
    render(<DateRangeFilter ranges={ranges} current="Last 30 Days" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "7" } });

    expect(router.get).toHaveBeenCalledWith(
      "/dashboard",
      { days: 7 },
      expect.objectContaining({ preserveState: true })
    );
  });
});
```

```typescript
// spec/javascript/components/dashboard/ProjectsTable.test.tsx
import { render, screen } from "@testing-library/react";
import { ProjectsTable } from "@components/dashboard/ProjectsTable";

describe("ProjectsTable", () => {
  const mockProjects = [
    {
      uuid: "abc-123",
      name: "Premium Pet Portraits",
      status: "live",
      total_leads: 45,
      total_page_views: 1200,
      ctr: 0.042,
      cpl_dollars: 28.5,
      total_spend_dollars: 1282.5,
    },
    {
      uuid: "def-456",
      name: "Test Project",
      status: "draft",
      total_leads: 0,
      total_page_views: 0,
      ctr: null,
      cpl_dollars: null,
      total_spend_dollars: 0,
    },
  ];

  it("renders all projects", () => {
    render(<ProjectsTable projects={mockProjects} />);
    expect(screen.getByText("Premium Pet Portraits")).toBeInTheDocument();
    expect(screen.getByText("Test Project")).toBeInTheDocument();
  });

  it("formats currency values", () => {
    render(<ProjectsTable projects={mockProjects} />);
    expect(screen.getByText("$28.50")).toBeInTheDocument();
    expect(screen.getByText("$1,282.50")).toBeInTheDocument();
  });

  it("formats percentages", () => {
    render(<ProjectsTable projects={mockProjects} />);
    expect(screen.getByText("4.2%")).toBeInTheDocument();
  });

  it("shows dash for null values", () => {
    render(<ProjectsTable projects={mockProjects} />);
    // Test Project has null CTR
    const row = screen.getByText("Test Project").closest("tr");
    expect(row).toHaveTextContent("—");
  });

  it("shows status badges", () => {
    render(<ProjectsTable projects={mockProjects} />);
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });
});
```

```typescript
// spec/javascript/components/dashboard/ProjectStatusTabs.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { ProjectStatusTabs } from "@components/dashboard/ProjectStatusTabs";

describe("ProjectStatusTabs", () => {
  it("renders all tabs", () => {
    render(<ProjectStatusTabs current="all" onChange={() => {}} />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("highlights current tab", () => {
    render(<ProjectStatusTabs current="live" onChange={() => {}} />);
    expect(screen.getByText("Live")).toHaveClass("bg-primary");
  });

  it("calls onChange on click", () => {
    const onChange = jest.fn();
    render(<ProjectStatusTabs current="all" onChange={onChange} />);
    fireEvent.click(screen.getByText("Live"));
    expect(onChange).toHaveBeenCalledWith("live");
  });
});
```

```typescript
// spec/javascript/components/dashboard/TrendIndicator.test.tsx
import { render, screen } from "@testing-library/react";
import { TrendIndicator } from "@components/dashboard/TrendIndicator";

describe("TrendIndicator", () => {
  it("shows up arrow for positive trend", () => {
    render(<TrendIndicator percent={12.5} direction="up" />);
    expect(screen.getByText("+12.5%")).toBeInTheDocument();
    expect(screen.getByTestId("arrow-up")).toBeInTheDocument();
  });

  it("shows down arrow for negative trend", () => {
    render(<TrendIndicator percent={8.3} direction="down" />);
    expect(screen.getByText("-8.3%")).toBeInTheDocument();
    expect(screen.getByTestId("arrow-down")).toBeInTheDocument();
  });

  it("uses green color for positive", () => {
    const { container } = render(<TrendIndicator percent={10} direction="up" />);
    expect(container.firstChild).toHaveClass("text-green-600");
  });

  it("uses red color for negative", () => {
    const { container } = render(<TrendIndicator percent={10} direction="down" />);
    expect(container.firstChild).toHaveClass("text-red-600");
  });

  it("shows nothing when percent is null", () => {
    const { container } = render(<TrendIndicator percent={null} direction={null} />);
    expect(container.firstChild).toBeEmptyDOMElement();
  });
});
```

### Verification

- `pnpm test` passes all component tests
- Visual review in Storybook or browser
- Responsive testing at 1280px, 768px, 375px widths

---

## Phase B3: Navigation

### Steps

1. Add dashboard link to sidebar

### Tests Required

```typescript
// spec/javascript/components/layout/Sidebar.test.tsx
describe("Sidebar", () => {
  it("includes dashboard link", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/dashboard");
  });

  it("highlights dashboard when active", () => {
    // Mock current path as /dashboard
    render(<Sidebar currentPath="/dashboard" />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveClass("active");
  });
});
```

---

# Track C: Langgraph Insights

**Owner**: Langgraph/TypeScript engineer
**Estimated effort**: ~20% of total
**Directory**: `langgraph_app/`

## User Outcomes

1. **Insights are actionable** - Users understand what to do next
2. **Generation is fast** - <5s to see insights
3. **Insights are accurate** - Numbers match the dashboard data
4. **Credit usage is clear** - Users know AI credits were consumed
5. **Caching works** - Repeat visits don't consume credits

## Performance Constraints

| Constraint         | Target       | Why                  |
| ------------------ | ------------ | -------------------- |
| Insight generation | <5s          | User patience        |
| Token usage        | <2000 tokens | Cost control         |
| Database write     | <100ms       | Don't block response |
| Stream first byte  | <500ms       | Perceived speed      |

## What Could Go Wrong

| Risk                          | Impact           | Mitigation                              |
| ----------------------------- | ---------------- | --------------------------------------- |
| LLM returns <3 or >3 insights | Schema violation | Zod validation, retry logic             |
| LLM hallucinates numbers      | Wrong insights   | Include actual numbers in prompt        |
| Database upsert fails         | Lost insights    | Retry, log, return insights anyway      |
| Out of credits                | Generation fails | Check credits upfront, show error state |
| Metrics summary too large     | Prompt too long  | Truncate project list to top 10         |

---

## Phase C1: Annotation + Node

### Steps

1. Create `insightsAnnotation.ts`
2. Create `generateInsights.ts` node
3. Export from index files

### Tests Required

```typescript
// tests/annotation/insightsAnnotation.test.ts
import { metricsSummarySchema, insightSchema, insightsOutputSchema } from "@annotation";

describe("insightsAnnotation", () => {
  describe("metricsSummarySchema", () => {
    it("validates correct structure", () => {
      const valid = {
        date_range: "Last 30 Days",
        totals: {
          leads: { current: 100, trend_percent: 12.5 },
          page_views: { current: 5000, trend_percent: -5.2 },
          ctr: { current: 0.042, trend_percent: 8.1, available: true },
          cpl: { current: 28.5, trend_percent: -15.0, available: true },
        },
        projects: [
          {
            uuid: "abc-123",
            name: "Test Project",
            status: "live",
            leads: 50,
            page_views: 2500,
            ctr: 0.042,
            cpl: 28.5,
            spend: 1425.0,
          },
        ],
        trends: {
          leads_trend: 12.5,
          page_views_trend: -5.2,
          ctr_trend: 8.1,
          cpl_trend: -15.0,
        },
      };

      expect(() => metricsSummarySchema.parse(valid)).not.toThrow();
    });

    it("allows null values for optional metrics", () => {
      const withNulls = {
        date_range: "Last 30 Days",
        totals: {
          leads: { current: 100, trend_percent: null },
          page_views: { current: 5000, trend_percent: null },
          ctr: { current: null, trend_percent: null, available: false },
          cpl: { current: null, trend_percent: null, available: false },
        },
        projects: [],
        trends: {
          leads_trend: null,
          page_views_trend: null,
          ctr_trend: null,
          cpl_trend: null,
        },
      };

      expect(() => metricsSummarySchema.parse(withNulls)).not.toThrow();
    });
  });

  describe("insightSchema", () => {
    it("validates correct insight structure", () => {
      const valid = {
        title: "Lead Generation Stalled",
        description: "Premium Pet Portraits hasn't generated leads in 7 days.",
        sentiment: "negative",
        metric_type: "leads",
        project_uuid: "abc-123",
      };

      expect(() => insightSchema.parse(valid)).not.toThrow();
    });

    it("rejects invalid sentiment", () => {
      const invalid = {
        title: "Test",
        description: "Test",
        sentiment: "bad", // Invalid
        metric_type: "leads",
      };

      expect(() => insightSchema.parse(invalid)).toThrow();
    });

    it("allows optional fields", () => {
      const minimal = {
        title: "Test",
        description: "Test description",
        sentiment: "positive",
        metric_type: "leads",
      };

      expect(() => insightSchema.parse(minimal)).not.toThrow();
    });
  });

  describe("insightsOutputSchema", () => {
    it("requires exactly 3 insights", () => {
      const twoInsights = {
        insights: [
          { title: "A", description: "A", sentiment: "positive", metric_type: "leads" },
          { title: "B", description: "B", sentiment: "negative", metric_type: "ctr" },
        ],
      };

      expect(() => insightsOutputSchema.parse(twoInsights)).toThrow();
    });

    it("accepts exactly 3 insights", () => {
      const threeInsights = {
        insights: [
          { title: "A", description: "A", sentiment: "positive", metric_type: "leads" },
          { title: "B", description: "B", sentiment: "negative", metric_type: "ctr" },
          { title: "C", description: "C", sentiment: "neutral", metric_type: "spend" },
        ],
      };

      expect(() => insightsOutputSchema.parse(threeInsights)).not.toThrow();
    });
  });
});
```

```typescript
// tests/nodes/insights/generateInsights.test.ts
import { generateInsights } from "@nodes";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@core", () => ({
  getLLM: vi.fn(() => ({
    withStructuredOutput: vi.fn(() => ({
      invoke: vi.fn(() => ({
        insights: [
          { title: "Test 1", description: "Desc 1", sentiment: "positive", metric_type: "leads" },
          { title: "Test 2", description: "Desc 2", sentiment: "negative", metric_type: "ctr" },
          { title: "Test 3", description: "Desc 3", sentiment: "neutral", metric_type: "spend" },
        ],
      })),
    })),
  })),
}));

vi.mock("@db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
  dashboardInsights: {},
}));

describe("generateInsights", () => {
  const mockState = {
    accountId: 1,
    metricsSummary: {
      date_range: "Last 30 Days",
      totals: {
        leads: { current: 100, trend_percent: 12.5 },
        page_views: { current: 5000, trend_percent: -5.2 },
        ctr: { current: 0.042, trend_percent: 8.1, available: true },
        cpl: { current: 28.5, trend_percent: -15.0, available: true },
      },
      projects: [],
      trends: { leads_trend: 12.5, page_views_trend: -5.2, ctr_trend: 8.1, cpl_trend: -15.0 },
    },
  };

  it("returns error when metricsSummary is missing", async () => {
    const result = await generateInsights({ accountId: 1 }, {});
    expect(result.status).toBe("error");
    expect(result.error?.message).toContain("metrics summary");
  });

  it("returns error when accountId is missing", async () => {
    const result = await generateInsights({ metricsSummary: mockState.metricsSummary }, {});
    expect(result.status).toBe("error");
    expect(result.error?.message).toContain("account ID");
  });

  it("returns 3 insights on success", async () => {
    const result = await generateInsights(mockState, {});
    expect(result.status).toBe("completed");
    expect(result.insights).toHaveLength(3);
  });

  it("saves insights to database", async () => {
    const { db } = await import("@db");
    await generateInsights(mockState, {});
    expect(db.insert).toHaveBeenCalled();
  });

  it("returns structured message for frontend", async () => {
    const result = await generateInsights(mockState, {});
    expect(result.messages).toHaveLength(1);
    const content = JSON.parse(result.messages[0].content);
    expect(content.type).toBe("insights_generated");
    expect(content.insights).toHaveLength(3);
  });
});
```

### Verification

- `pnpm test tests/annotation/insightsAnnotation.test.ts` passes
- `pnpm test tests/nodes/insights/` passes

---

## Phase C2: Graph + API + Route

### Steps

1. Create `insights.ts` graph
2. Create `insights.ts` API
3. Create `insights.ts` route
4. Register route in server.ts

### Tests Required

```typescript
// tests/graphs/insights.test.ts
import { insightsGraph } from "@graphs";
import { describe, it, expect } from "vitest";

describe("insightsGraph", () => {
  it("compiles without errors", () => {
    const compiled = insightsGraph.compile({ name: "test" });
    expect(compiled).toBeDefined();
  });

  it("has generateInsights node", () => {
    const nodes = insightsGraph.nodes;
    expect(nodes).toContain("generateInsights");
  });
});
```

```typescript
// tests/server/routes/insights.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { testClient } from "hono/testing";
import { insightsRoutes } from "@server/routes";

describe("insightsRoutes", () => {
  describe("GET /health", () => {
    it("returns ok status", async () => {
      const res = await testClient(insightsRoutes).health.$get();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe("ok");
      expect(json.graph).toBe("insights");
    });
  });

  describe("POST /stream", () => {
    it("returns 400 when threadId missing", async () => {
      const res = await testClient(insightsRoutes).stream.$post({
        json: { state: { metricsSummary: {} } },
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("threadId");
    });

    it("returns 400 when metricsSummary missing", async () => {
      const res = await testClient(insightsRoutes).stream.$post({
        json: { threadId: "test-thread", state: {} },
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("metricsSummary");
    });
  });
});
```

### Verification

- `pnpm test tests/graphs/insights.test.ts` passes
- `pnpm test tests/server/routes/insights.test.ts` passes
- `curl http://localhost:4300/api/insights/health` returns 200

---

## Phase C3: Frontend Integration

### Steps

1. Create `useInsightsInit.ts` hook
2. Create `KeyInsights.tsx` component
3. Integrate into Dashboard page

### Tests Required

```typescript
// spec/javascript/hooks/useInsightsInit.test.tsx
import { renderHook } from "@testing-library/react-hooks";
import { useInsightsInit } from "@hooks/useInsightsInit";

jest.mock("@inertiajs/react", () => ({
  usePage: () => ({
    props: {
      insights: null,
      metrics_summary: { date_range: "Last 30 Days", totals: {}, projects: [], trends: {} },
    },
  }),
}));

jest.mock("./useChatOptions", () => ({
  useChatOptions: () => ({ apiPath: "api/insights/stream" }),
}));

jest.mock("langgraph-ai-sdk-react", () => ({
  useLanggraph: () => ({
    actions: {
      updateState: jest.fn(() => Promise.resolve()),
    },
  }),
}));

describe("useInsightsInit", () => {
  it("triggers generation when insights are null and metrics_summary exists", async () => {
    const { result, waitFor } = renderHook(() => useInsightsInit());

    await waitFor(() => {
      expect(result.current.isGenerating).toBe(true);
    });
  });

  it("does not trigger when insights already exist", async () => {
    jest.mock("@inertiajs/react", () => ({
      usePage: () => ({
        props: {
          insights: [{ title: "Test" }],
          metrics_summary: null,
        },
      }),
    }));

    const { result } = renderHook(() => useInsightsInit());
    expect(result.current.isGenerating).toBe(false);
  });

  it("prevents double generation", async () => {
    const updateState = jest.fn(() => Promise.resolve());
    jest.mock("langgraph-ai-sdk-react", () => ({
      useLanggraph: () => ({ actions: { updateState } }),
    }));

    const { rerender } = renderHook(() => useInsightsInit());
    rerender();
    rerender();

    expect(updateState).toHaveBeenCalledTimes(1);
  });
});
```

```typescript
// spec/javascript/components/dashboard/KeyInsights.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { KeyInsights } from "@components/dashboard/KeyInsights";
import { router } from "@inertiajs/react";

jest.mock("@hooks/useInsightsInit", () => ({
  useInsightsInit: () => ({
    insights: [
      { title: "Lead Generation Stalled", description: "Test desc", sentiment: "negative", metric_type: "leads" },
      { title: "CTR Improved", description: "Test desc", sentiment: "positive", metric_type: "ctr" },
      { title: "Cost Decreasing", description: "Test desc", sentiment: "neutral", metric_type: "cpl" },
    ],
    isGenerating: false,
  }),
}));

describe("KeyInsights", () => {
  it("renders 3 insight cards", () => {
    render(<KeyInsights />);
    expect(screen.getByText("Lead Generation Stalled")).toBeInTheDocument();
    expect(screen.getByText("CTR Improved")).toBeInTheDocument();
    expect(screen.getByText("Cost Decreasing")).toBeInTheDocument();
  });

  it("applies correct sentiment colors", () => {
    render(<KeyInsights />);
    const negativeCard = screen.getByText("Lead Generation Stalled").closest("div");
    const positiveCard = screen.getByText("CTR Improved").closest("div");

    expect(negativeCard).toHaveClass("bg-amber-50");
    expect(positiveCard).toHaveClass("bg-green-50");
  });

  it("shows skeletons when generating", () => {
    jest.mock("@hooks/useInsightsInit", () => ({
      useInsightsInit: () => ({ insights: null, isGenerating: true }),
    }));

    render(<KeyInsights />);
    expect(screen.getAllByTestId("insight-skeleton")).toHaveLength(3);
  });

  it("shows regenerate button when insights exist", () => {
    render(<KeyInsights />);
    expect(screen.getByText("Regenerate")).toBeInTheDocument();
  });

  it("triggers regeneration on button click", () => {
    render(<KeyInsights />);
    fireEvent.click(screen.getByText("Regenerate"));

    expect(router.visit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ data: { regenerate_insights: true } })
    );
  });

  it("navigates on Review click", () => {
    jest.mock("@hooks/useInsightsInit", () => ({
      useInsightsInit: () => ({
        insights: [
          { title: "Test", description: "Desc", sentiment: "positive", metric_type: "leads", project_uuid: "abc-123" },
        ],
        isGenerating: false,
      }),
    }));

    render(<KeyInsights />);
    fireEvent.click(screen.getByText("Review"));

    expect(router.visit).toHaveBeenCalledWith("/projects/abc-123/website");
  });
});
```

### Verification

- `pnpm test spec/javascript/hooks/useInsightsInit.test.tsx` passes
- `pnpm test spec/javascript/components/dashboard/KeyInsights.test.tsx` passes
- E2E: Visit `/dashboard` with no insights, verify generation triggers and displays

---

# Cross-Track Integration Tests

Once all tracks are complete, run these integration tests:

## E2E Tests (Playwright)

```typescript
// e2e/dashboard.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    // Login and seed test data
    await page.goto("/test/login");
    await page.goto("/test/seed/dashboard");
  });

  test("loads dashboard with charts", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("Performance Overview")).toBeVisible();
    await expect(page.locator(".recharts-wrapper")).toHaveCount(4);
  });

  test("date range filter updates charts", async ({ page }) => {
    await page.goto("/dashboard");

    await page.selectOption("[data-testid=date-range-filter]", "7");
    await expect(page).toHaveURL(/days=7/);
    await expect(page.getByText("Last 7 Days")).toBeVisible();
  });

  test("generates insights when stale", async ({ page }) => {
    await page.goto("/dashboard");

    // Should show loading skeletons
    await expect(page.locator("[data-testid=insight-skeleton]")).toHaveCount(3);

    // Wait for generation
    await expect(page.getByText("Key Insights")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("[data-testid=insight-card]")).toHaveCount(3);
  });

  test("cached insights load immediately", async ({ page }) => {
    // First visit generates
    await page.goto("/dashboard");
    await expect(page.locator("[data-testid=insight-card]")).toHaveCount(3, { timeout: 10000 });

    // Second visit should be instant
    await page.reload();
    await expect(page.locator("[data-testid=insight-card]")).toHaveCount(3, { timeout: 1000 });
  });

  test("regenerate button refreshes insights", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("[data-testid=insight-card]")).toHaveCount(3, { timeout: 10000 });

    const firstTitle = await page.locator("[data-testid=insight-card]").first().textContent();

    await page.click("text=Regenerate");
    await expect(page.locator("[data-testid=insight-skeleton]")).toHaveCount(3);
    await expect(page.locator("[data-testid=insight-card]")).toHaveCount(3, { timeout: 10000 });

    // Content may have changed (LLM non-determinism)
  });

  test("projects table shows correct data", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("Premium Pet Portraits")).toBeVisible();
    await expect(page.getByText("$28.50")).toBeVisible(); // CPL
  });

  test("status filter works client-side", async ({ page }) => {
    await page.goto("/dashboard");

    await page.click("text=Live");
    await expect(page.locator("[data-testid=project-row]")).toHaveCount(1);

    await page.click("text=All");
    await expect(page.locator("[data-testid=project-row]")).toHaveCount(2);
  });
});
```

---

# Summary

| Track             | Tests                              | Performance     | Key Risks                       |
| ----------------- | ---------------------------------- | --------------- | ------------------------------- |
| **A (Rails)**     | Model, Service, Worker, Controller | <500ms response | N+1 queries, cache stampede     |
| **B (Frontend)**  | Component, Integration             | <2.5s LCP       | Chart flicker, bundle size      |
| **C (Langgraph)** | Schema, Node, Route, Hook          | <5s generation  | LLM validation, credit tracking |
