# frozen_string_literal: true

require "rails_helper"

RSpec.describe Analytics::Metrics::PageViewsMetric do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project) }

  subject { described_class.new(account, 7.days.ago, Date.current) }

  describe "#time_series" do
    before do
      # Create pre-computed historical data
      create(:analytics_daily_metric, account: account, project: project,
        date: 3.days.ago, page_views_count: 200)
      create(:analytics_daily_metric, account: account, project: project,
        date: 1.day.ago, page_views_count: 150)
    end

    it "returns dates array" do
      result = subject.time_series
      expect(result[:dates].length).to eq(8) # 7 days + today
    end

    it "returns series grouped by project" do
      result = subject.time_series
      expect(result[:series].first[:project_name]).to eq(project.name)
      expect(result[:series].first[:data].sum).to eq(350) # 200 + 150
    end

    it "calculates trend percentage" do
      result = subject.time_series
      expect(result[:totals]).to have_key(:trend_percent)
      expect(result[:totals]).to have_key(:trend_direction)
    end

    it "includes current and previous totals" do
      result = subject.time_series
      expect(result[:totals]).to have_key(:current)
      expect(result[:totals]).to have_key(:previous)
    end
  end

  describe "#live_count_for_project_today" do
    context "when website has visits today" do
      it "counts visits from Ahoy::Visit for today" do
        # Create visits for today
        create(:ahoy_visit, website: website, started_at: 1.hour.ago)
        create(:ahoy_visit, website: website, started_at: 2.hours.ago)
        create(:ahoy_visit, website: website, started_at: 3.hours.ago)

        result = subject.time_series
        today_data = result[:series].first[:data].last

        expect(today_data).to eq(3)
      end
    end

    context "when website has visits from other days" do
      it "does not count visits from other days" do
        # Visits from yesterday should not count for today's live count
        create(:ahoy_visit, website: website, started_at: 1.day.ago)
        create(:ahoy_visit, website: website, started_at: 2.days.ago)

        # Only this one should count
        create(:ahoy_visit, website: website, started_at: 1.hour.ago)

        result = subject.time_series
        today_data = result[:series].first[:data].last

        expect(today_data).to eq(1)
      end
    end

    context "when website has no visits" do
      before do
        # Ensure website exists but has no visits
        website
      end

      it "returns 0" do
        result = subject.time_series
        today_data = result[:series].first[:data].last

        expect(today_data).to eq(0)
      end
    end

    context "when project has no website" do
      let(:project_without_website) { create(:project, account: account) }

      before do
        project_without_website.website&.destroy
      end

      it "returns 0 for that project" do
        # Force reload to get fresh project without website
        project_without_website.reload

        result = subject.time_series
        project_series = result[:series].find { |s| s[:project_id] == project_without_website.id }

        # Project without website should have all zeros
        expect(project_series[:data].last).to eq(0) if project_series
      end
    end
  end

  describe "trend calculation" do
    it "shows positive trend when this period > last period" do
      # Last period (8-14 days ago): 100 page views
      create(:analytics_daily_metric, account: account, project: project,
        date: 10.days.ago, page_views_count: 100)

      # This period: 200 page views
      create(:analytics_daily_metric, account: account, project: project,
        date: 2.days.ago, page_views_count: 200)

      result = subject.time_series

      expect(result[:totals][:trend_direction]).to eq("up")
      expect(result[:totals][:trend_percent]).to eq(100.0)
    end

    it "shows negative trend when this period < last period" do
      # Last period: 200 page views
      create(:analytics_daily_metric, account: account, project: project,
        date: 10.days.ago, page_views_count: 200)

      # This period: 100 page views
      create(:analytics_daily_metric, account: account, project: project,
        date: 2.days.ago, page_views_count: 100)

      result = subject.time_series

      expect(result[:totals][:trend_direction]).to eq("down")
      expect(result[:totals][:trend_percent]).to eq(50.0)
    end
  end
end
