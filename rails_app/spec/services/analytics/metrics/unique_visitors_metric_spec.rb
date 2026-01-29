# frozen_string_literal: true

require "rails_helper"

RSpec.describe Analytics::Metrics::UniqueVisitorsMetric do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project) }

  subject { described_class.new(account, 7.days.ago.to_date, Date.current) }

  describe "#time_series" do
    context "with pre-computed historical data" do
      before do
        create(:analytics_daily_metric,
          account: account, project: project,
          date: 5.days.ago, unique_visitors_count: 50)
        create(:analytics_daily_metric,
          account: account, project: project,
          date: 3.days.ago, unique_visitors_count: 75)
      end

      it "returns dates array covering the range" do
        result = subject.time_series
        expect(result[:dates].length).to eq(8) # 7 days + today
      end

      it "returns series grouped by project" do
        result = subject.time_series
        expect(result[:series].first[:project_name]).to eq(project.name)
      end

      it "uses unique_visitors_count from analytics_daily_metrics" do
        result = subject.time_series
        project_series = result[:series].find { |s| s[:project_id] == project.id }
        total = project_series[:data].sum
        expect(total).to eq(125) # 50 + 75
      end

      it "calculates trend percentage" do
        result = subject.time_series
        expect(result[:totals]).to have_key(:trend_percent)
        expect(result[:totals]).to have_key(:trend_direction)
      end
    end

    context "for today's live data" do
      before do
        # Create visits (sessions) for today
        create(:ahoy_visit, website: website, started_at: 1.hour.ago)
        create(:ahoy_visit, website: website, started_at: 2.hours.ago)
        create(:ahoy_visit, website: website, started_at: 3.hours.ago)
      end

      it "counts unique visitors (sessions) for today" do
        result = subject.time_series
        project_series = result[:series].find { |s| s[:project_id] == project.id }
        today_count = project_series[:data].last

        expect(today_count).to eq(3) # 3 visits/sessions
      end

      it "does not count visits from other days in today's count" do
        # Add visits from yesterday
        create(:ahoy_visit, website: website, started_at: 1.day.ago)
        create(:ahoy_visit, website: website, started_at: 1.day.ago)

        result = subject.time_series
        project_series = result[:series].find { |s| s[:project_id] == project.id }
        today_count = project_series[:data].last

        expect(today_count).to eq(3) # Only today's 3 visits
      end
    end

    context "combining historical and live data" do
      before do
        # Historical data
        create(:analytics_daily_metric,
          account: account, project: project,
          date: 2.days.ago, unique_visitors_count: 40)

        # Live data for today
        create(:ahoy_visit, website: website, started_at: 1.hour.ago)
        create(:ahoy_visit, website: website, started_at: 2.hours.ago)
      end

      it "shows both historical and live counts" do
        result = subject.time_series
        project_series = result[:series].find { |s| s[:project_id] == project.id }

        # 2 days ago (index 5 in 8-day range)
        expect(project_series[:data][5]).to eq(40)
        # Today (last element)
        expect(project_series[:data].last).to eq(2)
      end
    end

    context "when project has no website" do
      let(:project_without_website) { create(:project, account: account) }

      before do
        project_without_website.website&.destroy
      end

      it "returns 0 for that project" do
        project_without_website.reload

        result = subject.time_series
        project_series = result[:series].find { |s| s[:project_id] == project_without_website.id }

        expect(project_series[:data].last).to eq(0) if project_series
      end
    end
  end

  describe "trend calculation" do
    it "shows positive trend when this period > last period" do
      # Last period
      create(:analytics_daily_metric, account: account, project: project,
        date: 10.days.ago, unique_visitors_count: 50)
      # This period
      create(:analytics_daily_metric, account: account, project: project,
        date: 2.days.ago, unique_visitors_count: 100)

      result = subject.time_series

      expect(result[:totals][:trend_direction]).to eq("up")
      expect(result[:totals][:trend_percent]).to eq(100.0)
    end

    it "shows negative trend when this period < last period" do
      # Last period
      create(:analytics_daily_metric, account: account, project: project,
        date: 10.days.ago, unique_visitors_count: 100)
      # This period
      create(:analytics_daily_metric, account: account, project: project,
        date: 2.days.ago, unique_visitors_count: 50)

      result = subject.time_series

      expect(result[:totals][:trend_direction]).to eq("down")
      expect(result[:totals][:trend_percent]).to eq(50.0)
    end
  end
end
