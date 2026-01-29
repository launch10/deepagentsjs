# frozen_string_literal: true

require "rails_helper"

RSpec.describe Analytics::ComputeMetricsService do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project) }
  let(:target_date) { Date.yesterday }

  subject { described_class.new(project, date: target_date) }

  describe "#call" do
    context "with leads" do
      let(:lead) { create(:lead, account: account, email: "test@example.com") }

      before do
        create(:website_lead, website: website, lead: lead, created_at: target_date.to_time)
        create(:website_lead, website: website, lead: create(:lead, account: account, email: "test2@example.com"), created_at: target_date.to_time)
      end

      it "counts leads correctly" do
        subject.call
        metric = AnalyticsDailyMetric.last
        expect(metric.leads_count).to eq(2)
      end
    end

    context "with Ahoy visits" do
      before do
        create(:ahoy_visit, website: website, started_at: target_date.to_time)
        create(:ahoy_visit, website: website, started_at: target_date.to_time + 1.hour)
        create(:ahoy_visit, website: website, started_at: target_date.to_time + 2.hours)
      end

      it "counts unique visitors correctly" do
        subject.call
        metric = AnalyticsDailyMetric.last
        expect(metric.unique_visitors_count).to eq(3)
      end
    end

    context "with Ahoy page_view events" do
      let(:visit) { create(:ahoy_visit, website: website, started_at: target_date.to_time) }

      before do
        create(:ahoy_event, :page_view, visit: visit, time: target_date.to_time)
        create(:ahoy_event, :page_view, visit: visit, time: target_date.to_time + 5.minutes)
        create(:ahoy_event, :page_view, visit: visit, time: target_date.to_time + 10.minutes)
      end

      it "counts page views correctly" do
        subject.call
        metric = AnalyticsDailyMetric.last
        expect(metric.page_views_count).to eq(3)
      end
    end

    context "with ads performance data" do
      let(:campaign1) { create(:campaign, project: project, account: account, website: website) }
      let(:campaign2) { create(:campaign, project: project, account: account, website: website) }

      before do
        create(:ad_performance_daily, campaign: campaign1, date: target_date,
          impressions: 1000, clicks: 50, cost_micros: 25_000_000)
        create(:ad_performance_daily, campaign: campaign2, date: target_date,
          impressions: 500, clicks: 25, cost_micros: 10_000_000)
      end

      it "aggregates ads metrics from all campaigns" do
        subject.call
        metric = AnalyticsDailyMetric.last

        expect(metric.impressions).to eq(1500)
        expect(metric.clicks).to eq(75)
        expect(metric.cost_micros).to eq(35_000_000)
      end
    end

    context "without website" do
      let(:project_without_website) { create(:project, account: account) }
      subject { described_class.new(project_without_website, date: target_date) }

      it "returns zero for all website-based metrics" do
        subject.call
        metric = AnalyticsDailyMetric.last

        expect(metric.leads_count).to eq(0)
        expect(metric.unique_visitors_count).to eq(0)
        expect(metric.page_views_count).to eq(0)
      end
    end

    context "upsert behavior" do
      it "creates a new record" do
        expect {
          subject.call
        }.to change(AnalyticsDailyMetric, :count).by(1)
      end

      it "updates existing record on conflict" do
        subject.call
        original_metric = AnalyticsDailyMetric.last

        # Add more data
        lead = create(:lead, account: account, email: "new@example.com")
        create(:website_lead, website: website, lead: lead, created_at: target_date.to_time)

        expect {
          subject.call
        }.not_to change(AnalyticsDailyMetric, :count)

        updated_metric = AnalyticsDailyMetric.last
        expect(updated_metric.id).to eq(original_metric.id)
        expect(updated_metric.leads_count).to eq(1)
      end
    end

    context "record attributes" do
      it "sets correct account, project, and date" do
        subject.call
        metric = AnalyticsDailyMetric.last

        expect(metric.account_id).to eq(account.id)
        expect(metric.project_id).to eq(project.id)
        expect(metric.date).to eq(target_date)
      end
    end

    context "multi-tenant isolation" do
      # Account A with 2 projects
      let(:account_a) { account }
      let(:project_a1) { project }
      let(:website_a1) { website }
      let(:project_a2) { create(:project, account: account_a) }
      let(:website_a2) { create(:website, project: project_a2) }

      # Account B with 1 project
      let(:account_b) { create(:account) }
      let(:project_b1) { create(:project, account: account_b) }
      let(:website_b1) { create(:website, project: project_b1) }

      # Account C with 1 project
      let(:account_c) { create(:account) }
      let(:project_c1) { create(:project, account: account_c) }
      let(:website_c1) { create(:website, project: project_c1) }

      # Campaigns for ads data
      let(:campaign_a1) { create(:campaign, project: project_a1, account: account_a, website: website_a1) }
      let(:campaign_a2) { create(:campaign, project: project_a2, account: account_a, website: website_a2) }
      let(:campaign_b1) { create(:campaign, project: project_b1, account: account_b, website: website_b1) }
      let(:campaign_c1) { create(:campaign, project: project_c1, account: account_c, website: website_c1) }

      before do
        # Account A, Project 1: 3 leads, 5 visits, 100 impressions
        3.times do |i|
          lead = create(:lead, account: account_a, email: "a1_#{i}@example.com")
          create(:website_lead, website: website_a1, lead: lead, created_at: target_date.to_time)
        end
        5.times { create(:ahoy_visit, website: website_a1, started_at: target_date.to_time) }
        create(:ad_performance_daily, campaign: campaign_a1, date: target_date,
          impressions: 100, clicks: 10, cost_micros: 1_000_000)

        # Account A, Project 2: 2 leads, 3 visits, 200 impressions
        2.times do |i|
          lead = create(:lead, account: account_a, email: "a2_#{i}@example.com")
          create(:website_lead, website: website_a2, lead: lead, created_at: target_date.to_time)
        end
        3.times { create(:ahoy_visit, website: website_a2, started_at: target_date.to_time) }
        create(:ad_performance_daily, campaign: campaign_a2, date: target_date,
          impressions: 200, clicks: 20, cost_micros: 2_000_000)

        # Account B, Project 1: 10 leads, 20 visits, 500 impressions
        10.times do |i|
          lead = create(:lead, account: account_b, email: "b1_#{i}@example.com")
          create(:website_lead, website: website_b1, lead: lead, created_at: target_date.to_time)
        end
        20.times { create(:ahoy_visit, website: website_b1, started_at: target_date.to_time) }
        create(:ad_performance_daily, campaign: campaign_b1, date: target_date,
          impressions: 500, clicks: 50, cost_micros: 5_000_000)

        # Account C, Project 1: 1 lead, 1 visit, 50 impressions
        lead = create(:lead, account: account_c, email: "c1@example.com")
        create(:website_lead, website: website_c1, lead: lead, created_at: target_date.to_time)
        create(:ahoy_visit, website: website_c1, started_at: target_date.to_time)
        create(:ad_performance_daily, campaign: campaign_c1, date: target_date,
          impressions: 50, clicks: 5, cost_micros: 500_000)
      end

      it "isolates Account A Project 1 data correctly" do
        described_class.new(project_a1, date: target_date).call
        metric = AnalyticsDailyMetric.find_by(project: project_a1)

        expect(metric.account_id).to eq(account_a.id)
        expect(metric.leads_count).to eq(3)
        expect(metric.unique_visitors_count).to eq(5)
        expect(metric.impressions).to eq(100)
        expect(metric.clicks).to eq(10)
        expect(metric.cost_micros).to eq(1_000_000)
      end

      it "isolates Account A Project 2 data correctly" do
        described_class.new(project_a2, date: target_date).call
        metric = AnalyticsDailyMetric.find_by(project: project_a2)

        expect(metric.account_id).to eq(account_a.id)
        expect(metric.leads_count).to eq(2)
        expect(metric.unique_visitors_count).to eq(3)
        expect(metric.impressions).to eq(200)
        expect(metric.clicks).to eq(20)
        expect(metric.cost_micros).to eq(2_000_000)
      end

      it "isolates Account B data correctly" do
        described_class.new(project_b1, date: target_date).call
        metric = AnalyticsDailyMetric.find_by(project: project_b1)

        expect(metric.account_id).to eq(account_b.id)
        expect(metric.leads_count).to eq(10)
        expect(metric.unique_visitors_count).to eq(20)
        expect(metric.impressions).to eq(500)
        expect(metric.clicks).to eq(50)
        expect(metric.cost_micros).to eq(5_000_000)
      end

      it "isolates Account C data correctly" do
        described_class.new(project_c1, date: target_date).call
        metric = AnalyticsDailyMetric.find_by(project: project_c1)

        expect(metric.account_id).to eq(account_c.id)
        expect(metric.leads_count).to eq(1)
        expect(metric.unique_visitors_count).to eq(1)
        expect(metric.impressions).to eq(50)
        expect(metric.clicks).to eq(5)
        expect(metric.cost_micros).to eq(500_000)
      end

      it "computes all projects without cross-contamination" do
        # Compute metrics for all 4 projects
        [project_a1, project_a2, project_b1, project_c1].each do |proj|
          described_class.new(proj, date: target_date).call
        end

        expect(AnalyticsDailyMetric.count).to eq(4)

        # Verify totals match expected per-project values
        metric_a1 = AnalyticsDailyMetric.find_by(project: project_a1)
        metric_a2 = AnalyticsDailyMetric.find_by(project: project_a2)
        metric_b1 = AnalyticsDailyMetric.find_by(project: project_b1)
        metric_c1 = AnalyticsDailyMetric.find_by(project: project_c1)

        # Sum should equal total: 3+2+10+1 = 16 leads
        expect(metric_a1.leads_count + metric_a2.leads_count + metric_b1.leads_count + metric_c1.leads_count).to eq(16)

        # Each metric should have the correct account
        expect(metric_a1.account_id).to eq(account_a.id)
        expect(metric_a2.account_id).to eq(account_a.id)
        expect(metric_b1.account_id).to eq(account_b.id)
        expect(metric_c1.account_id).to eq(account_c.id)
      end

      it "recomputing one project does not affect others" do
        # Compute all
        [project_a1, project_a2, project_b1, project_c1].each do |proj|
          described_class.new(proj, date: target_date).call
        end

        # Add more data to project A1
        lead = create(:lead, account: account_a, email: "a1_extra@example.com")
        create(:website_lead, website: website_a1, lead: lead, created_at: target_date.to_time)

        # Recompute only project A1
        described_class.new(project_a1, date: target_date).call

        # Project A1 should be updated
        metric_a1 = AnalyticsDailyMetric.find_by(project: project_a1)
        expect(metric_a1.leads_count).to eq(4)

        # Others should be unchanged
        metric_a2 = AnalyticsDailyMetric.find_by(project: project_a2)
        metric_b1 = AnalyticsDailyMetric.find_by(project: project_b1)
        metric_c1 = AnalyticsDailyMetric.find_by(project: project_c1)

        expect(metric_a2.leads_count).to eq(2)
        expect(metric_b1.leads_count).to eq(10)
        expect(metric_c1.leads_count).to eq(1)
      end
    end

    context "date boundary - excludes adjacent days" do
      let(:lead) { create(:lead, account: account, email: "target@example.com") }

      before do
        # Lead on target date (should be counted)
        create(:website_lead, website: website, lead: lead, created_at: target_date.to_time + 12.hours)

        # Lead day before (should NOT be counted)
        create(:website_lead, website: website, lead: create(:lead, account: account, email: "before@example.com"),
          created_at: (target_date - 1.day).to_time + 12.hours)

        # Lead day after (should NOT be counted)
        create(:website_lead, website: website, lead: create(:lead, account: account, email: "after@example.com"),
          created_at: (target_date + 1.day).to_time + 12.hours)

        # Visits
        create(:ahoy_visit, website: website, started_at: target_date.to_time + 12.hours)
        create(:ahoy_visit, website: website, started_at: (target_date - 1.day).to_time)
        create(:ahoy_visit, website: website, started_at: (target_date + 1.day).to_time)
      end

      it "only counts data from the target date" do
        subject.call
        metric = AnalyticsDailyMetric.last

        expect(metric.leads_count).to eq(1)
        expect(metric.unique_visitors_count).to eq(1)
      end
    end

    context "date boundary - ads from adjacent days" do
      let(:campaign) { create(:campaign, project: project, account: account, website: website) }

      before do
        # Ads data on target date
        create(:ad_performance_daily, campaign: campaign, date: target_date,
          impressions: 1000, clicks: 50, cost_micros: 25_000_000)

        # Ads data day before (should NOT be aggregated)
        create(:ad_performance_daily, campaign: campaign, date: target_date - 1.day,
          impressions: 500, clicks: 25, cost_micros: 10_000_000)

        # Ads data day after (should NOT be aggregated)
        create(:ad_performance_daily, campaign: campaign, date: target_date + 1.day,
          impressions: 500, clicks: 25, cost_micros: 10_000_000)
      end

      it "only aggregates ads data from the target date" do
        subject.call
        metric = AnalyticsDailyMetric.last

        expect(metric.impressions).to eq(1000)
        expect(metric.clicks).to eq(50)
        expect(metric.cost_micros).to eq(25_000_000)
      end
    end

    context "non page_view events are excluded" do
      let(:visit) { create(:ahoy_visit, website: website, started_at: target_date.to_time) }

      before do
        # page_view events (should be counted)
        create(:ahoy_event, :page_view, visit: visit, time: target_date.to_time)
        create(:ahoy_event, :page_view, visit: visit, time: target_date.to_time + 5.minutes)

        # Other event types (should NOT be counted)
        create(:ahoy_event, visit: visit, name: "button_click", time: target_date.to_time)
        create(:ahoy_event, visit: visit, name: "form_submit", time: target_date.to_time)
        create(:ahoy_event, visit: visit, name: "scroll", time: target_date.to_time)
      end

      it "only counts page_view events" do
        subject.call
        metric = AnalyticsDailyMetric.last

        expect(metric.page_views_count).to eq(2)
      end
    end

    context "edge case: all zero values" do
      it "stores zeros not nulls when no data exists" do
        subject.call
        metric = AnalyticsDailyMetric.last

        expect(metric.leads_count).to eq(0)
        expect(metric.unique_visitors_count).to eq(0)
        expect(metric.page_views_count).to eq(0)
        expect(metric.impressions).to eq(0)
        expect(metric.clicks).to eq(0)
        expect(metric.cost_micros).to eq(0)
      end
    end

    context "edge case: no campaigns" do
      before do
        # Project has no campaigns, but has website data
        lead = create(:lead, account: account, email: "test@example.com")
        create(:website_lead, website: website, lead: lead, created_at: target_date.to_time)
      end

      it "stores zero for ads metrics when no campaigns exist" do
        subject.call
        metric = AnalyticsDailyMetric.last

        expect(metric.leads_count).to eq(1)
        expect(metric.impressions).to eq(0)
        expect(metric.clicks).to eq(0)
        expect(metric.cost_micros).to eq(0)
      end
    end

    context "edge case: large values" do
      let(:campaign) { create(:campaign, project: project, account: account, website: website) }

      before do
        # Bulk insert visits for performance
        visits_data = 100.times.map do |i|
          {
            website_id: website.id,
            visitor_token: SecureRandom.hex(16),
            visit_token: SecureRandom.hex(16),
            started_at: target_date.beginning_of_day + (i % 23).hours
          }
        end
        Ahoy::Visit.insert_all(visits_data)

        # Large ads values
        create(:ad_performance_daily, campaign: campaign, date: target_date,
          impressions: 999_999_999,
          clicks: 50_000_000,
          cost_micros: 999_999_999_999)
      end

      it "handles large values without overflow" do
        subject.call
        metric = AnalyticsDailyMetric.last

        expect(metric.unique_visitors_count).to eq(100)
        expect(metric.impressions).to eq(999_999_999)
        expect(metric.clicks).to eq(50_000_000)
        expect(metric.cost_micros).to eq(999_999_999_999)
      end
    end

    context "recomputing for different dates" do
      let(:lead) { create(:lead, account: account, email: "test@example.com") }
      let(:yesterday) { Date.yesterday }
      let(:two_days_ago) { Date.yesterday - 1.day }

      before do
        create(:website_lead, website: website, lead: lead, created_at: yesterday.to_time)
        create(:website_lead, website: website, lead: create(:lead, account: account, email: "old@example.com"),
          created_at: two_days_ago.to_time)
      end

      it "creates separate records for different dates" do
        described_class.new(project, date: yesterday).call
        described_class.new(project, date: two_days_ago).call

        expect(AnalyticsDailyMetric.count).to eq(2)

        yesterday_metric = AnalyticsDailyMetric.find_by(project: project, date: yesterday)
        old_metric = AnalyticsDailyMetric.find_by(project: project, date: two_days_ago)

        expect(yesterday_metric.leads_count).to eq(1)
        expect(old_metric.leads_count).to eq(1)
      end
    end
  end
end
