# frozen_string_literal: true

require "rails_helper"

RSpec.describe Analytics::DashboardService do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project) }

  subject { described_class.new(account, days: 30, status_filter: "all") }

  around do |example|
    # Use memory store for cache tests
    original_store = Rails.cache
    Rails.cache = ActiveSupport::Cache::MemoryStore.new
    example.run
    Rails.cache = original_store
  end

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
      expect(result[:page_views]).to have_key(:dates)
      expect(result[:page_views]).to have_key(:series)
    end

    it "returns ctr with available flag" do
      result = subject.performance_overview
      expect(result[:ctr]).to have_key(:available)
    end

    it "returns cpl with available flag" do
      result = subject.performance_overview
      expect(result[:cpl]).to have_key(:available)
    end

    it "caches the result" do
      # First call
      subject.performance_overview

      # Modify data
      create(:analytics_daily_metric, account: account, project: project,
        date: 3.days.ago, leads_count: 50)

      # Second call should return cached result
      result = subject.performance_overview
      expect(result[:leads][:totals][:current]).to eq(10)
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
      expect(project_result[:total_page_views]).to eq(0)
    end

    it "calculates CPL correctly" do
      create(:analytics_daily_metric, account: account, project: project,
        date: 5.days.ago, leads_count: 5, cost_micros: 25_000_000) # $25

      result = subject.projects_summary
      project_result = result.find { |p| p[:uuid] == project.uuid }
      expect(project_result[:cpl]).to eq(5.0) # $25 / 5 leads
    end

    it "returns nil for CPL when no leads" do
      create(:analytics_daily_metric, account: account, project: project,
        date: 5.days.ago, leads_count: 0, cost_micros: 25_000_000)

      result = subject.projects_summary
      project_result = result.find { |p| p[:uuid] == project.uuid }
      expect(project_result[:cpl]).to be_nil
    end
  end

  describe "date range filtering" do
    it "respects days parameter" do
      create(:analytics_daily_metric, account: account, project: project,
        date: 60.days.ago, leads_count: 100)
      create(:analytics_daily_metric, account: account, project: project,
        date: 5.days.ago, leads_count: 10)

      service = described_class.new(account, days: 30, status_filter: "all")
      result = service.projects_summary

      project_result = result.find { |p| p[:uuid] == project.uuid }
      expect(project_result[:total_leads]).to eq(10) # Only recent
    end
  end

  describe "status_filter" do
    let!(:active_project) { create(:project, account: account) }
    let!(:paused_project) { create(:project, account: account) }

    before do
      create(:campaign, project: active_project, status: "active", account: account, website: create(:website, project: active_project))
      create(:campaign, project: paused_project, status: "paused", account: account, website: create(:website, project: paused_project))
    end

    it "filters by active status" do
      service = described_class.new(account, days: 30, status_filter: "active")
      result = service.projects_summary

      uuids = result.map { |p| p[:uuid] }
      expect(uuids).to include(active_project.uuid)
      expect(uuids).not_to include(paused_project.uuid)
    end

    it "filters by paused status" do
      service = described_class.new(account, days: 30, status_filter: "paused")
      result = service.projects_summary

      uuids = result.map { |p| p[:uuid] }
      expect(uuids).not_to include(active_project.uuid)
      expect(uuids).to include(paused_project.uuid)
    end
  end
end
