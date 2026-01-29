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
  end
end
