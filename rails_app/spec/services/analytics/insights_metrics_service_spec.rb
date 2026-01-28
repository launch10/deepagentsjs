# frozen_string_literal: true

require "rails_helper"

RSpec.describe Analytics::InsightsMetricsService do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:dashboard_service) { Analytics::DashboardService.new(account, days: 30, status_filter: "all") }

  subject { described_class.new(dashboard_service) }

  before do
    Analytics::CacheService.clear_for_account(account.id)
    create(:analytics_daily_metric, account: account, project: project,
           date: 5.days.ago, leads_count: 10, page_views_count: 100)
  end

  describe "#summary" do
    it "extracts totals for all metric types" do
      result = subject.summary
      expect(result[:totals]).to have_key(:leads)
      expect(result[:totals]).to have_key(:page_views)
      expect(result[:totals]).to have_key(:ctr)
      expect(result[:totals]).to have_key(:cpl)
    end

    it "includes availability flags for ads metrics" do
      result = subject.summary
      expect(result[:totals]).to have_key(:ctr_available)
      expect(result[:totals]).to have_key(:cpl_available)
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

    it "includes trend direction and percent" do
      result = subject.summary
      expect(result[:trends][:leads_trend]).to have_key(:direction)
      expect(result[:trends][:leads_trend]).to have_key(:percent)
    end
  end
end
