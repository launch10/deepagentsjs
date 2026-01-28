# frozen_string_literal: true

require "rails_helper"

RSpec.describe Analytics::ComputeDailyMetricsWorker do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project) }
  let(:target_date) { Date.yesterday }

  describe "#perform" do
    context "with date argument" do
      let(:lead) { create(:lead, account: account, email: "test@example.com") }

      before do
        # Create source data
        create(:website_lead, website: website, lead: lead, created_at: target_date.to_time)
        # Create Ahoy visits for page views (L10.track)
        create(:ahoy_visit, website: website, started_at: target_date.to_time)
        create(:ahoy_visit, website: website, started_at: target_date.to_time + 1.hour)
        create(:ahoy_visit, website: website, started_at: target_date.to_time + 2.hours)
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

      it "aggregates page views from Ahoy visits correctly" do
        subject.perform(target_date.iso8601)
        metric = AnalyticsDailyMetric.last
        expect(metric.page_views_count).to eq(3)
      end

      it "upserts on conflict (idempotent)" do
        subject.perform(target_date.iso8601)
        lead2 = create(:lead, account: account, email: "test2@example.com")
        create(:website_lead, website: website, lead: lead2, created_at: target_date.to_time)

        expect {
          subject.perform(target_date.iso8601)
        }.not_to change(AnalyticsDailyMetric, :count)

        metric = AnalyticsDailyMetric.last
        expect(metric.leads_count).to eq(2)
      end

      it "sets correct account and project IDs" do
        subject.perform(target_date.iso8601)
        metric = AnalyticsDailyMetric.last

        expect(metric.account_id).to eq(account.id)
        expect(metric.project_id).to eq(project.id)
        expect(metric.date).to eq(target_date)
      end
    end

    context "without date argument (defaults to yesterday)" do
      it "processes yesterday's data" do
        expect(subject).to receive(:compute_for_account).with(account, Date.yesterday)
        allow(Account).to receive(:find_each).and_yield(account)
        subject.perform
      end
    end

    context "with ads performance data" do
      let(:campaign) { create(:campaign, project: project, account: account, website: website) }

      before do
        create(:ad_performance_daily, campaign: campaign, date: target_date,
          impressions: 1000, clicks: 50, cost_micros: 25_000_000)
      end

      it "aggregates ads metrics correctly" do
        subject.perform(target_date.iso8601)
        metric = AnalyticsDailyMetric.last

        expect(metric.impressions).to eq(1000)
        expect(metric.clicks).to eq(50)
        expect(metric.cost_micros).to eq(25_000_000)
      end
    end

    context "error handling" do
      let(:account1) { create(:account) }
      let(:account2) { create(:account) }
      let!(:project1) { create(:project, account: account1) }
      let!(:project2) { create(:project, account: account2) }

      it "continues processing other accounts on individual failure" do
        allow(Account).to receive(:find_each).and_yield(account1).and_yield(account2)
        allow(subject).to receive(:compute_for_account).with(account1, anything).and_raise(StandardError.new("test error"))
        allow(subject).to receive(:compute_for_account).with(account2, anything).and_call_original

        expect { subject.perform(target_date.iso8601) }.not_to raise_error
      end
    end
  end
end
