# frozen_string_literal: true

require "rails_helper"

RSpec.describe Analytics::ComputeMetricsForProjectWorker do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project) }
  let(:target_date) { Date.yesterday }

  describe "#perform" do
    it "calls ComputeMetricsService" do
      service = instance_double(Analytics::ComputeMetricsService)
      expect(Analytics::ComputeMetricsService).to receive(:new)
        .with(project, date: target_date)
        .and_return(service)
      expect(service).to receive(:call)

      subject.perform(project.id, target_date.iso8601)
    end

    context "integration" do
      let(:lead) { create(:lead, account: account, email: "test@example.com") }

      before do
        create(:website_lead, website: website, lead: lead, created_at: target_date.to_time)

        visit1 = create(:ahoy_visit, website: website, started_at: target_date.to_time)
        visit2 = create(:ahoy_visit, website: website, started_at: target_date.to_time + 1.hour)

        create(:ahoy_event, :page_view, visit: visit1, time: target_date.to_time)
        create(:ahoy_event, :page_view, visit: visit1, time: target_date.to_time + 5.minutes)
        create(:ahoy_event, :page_view, visit: visit2, time: target_date.to_time + 1.hour)
      end

      it "creates analytics_daily_metric record" do
        expect {
          subject.perform(project.id, target_date.iso8601)
        }.to change(AnalyticsDailyMetric, :count).by(1)
      end

      it "aggregates metrics correctly" do
        subject.perform(project.id, target_date.iso8601)
        metric = AnalyticsDailyMetric.last

        expect(metric.account_id).to eq(account.id)
        expect(metric.project_id).to eq(project.id)
        expect(metric.date).to eq(target_date)
        expect(metric.leads_count).to eq(1)
        expect(metric.unique_visitors_count).to eq(2)
        expect(metric.page_views_count).to eq(3)
      end

      it "upserts on conflict (idempotent)" do
        subject.perform(project.id, target_date.iso8601)
        lead2 = create(:lead, account: account, email: "test2@example.com")
        create(:website_lead, website: website, lead: lead2, created_at: target_date.to_time)

        expect {
          subject.perform(project.id, target_date.iso8601)
        }.not_to change(AnalyticsDailyMetric, :count)

        metric = AnalyticsDailyMetric.last
        expect(metric.leads_count).to eq(2)
      end
    end

    context "with ads performance data" do
      let(:campaign) { create(:campaign, project: project, account: account, website: website) }

      before do
        create(:ad_performance_daily, campaign: campaign, date: target_date,
          impressions: 1000, clicks: 50, cost_micros: 25_000_000)
      end

      it "aggregates ads metrics correctly" do
        subject.perform(project.id, target_date.iso8601)
        metric = AnalyticsDailyMetric.last

        expect(metric.impressions).to eq(1000)
        expect(metric.clicks).to eq(50)
        expect(metric.cost_micros).to eq(25_000_000)
      end
    end
  end
end
