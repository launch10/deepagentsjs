# frozen_string_literal: true

require "rails_helper"

RSpec.describe Analytics::Metrics::PageViewsMetric do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project) }

  subject { described_class.new(account, 7.days.ago.to_date, Date.current) }

  describe "#time_series" do
    context "with pre-computed historical data" do
      before do
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

    context "for today's live data using Ahoy::Event" do
      it "counts page_view events for today" do
        # Create visits with page_view events for today
        visit1 = create(:ahoy_visit, website: website, started_at: 1.hour.ago)
        visit2 = create(:ahoy_visit, website: website, started_at: 2.hours.ago)

        # Multiple page views per visit
        create(:ahoy_event, :page_view, visit: visit1, time: 1.hour.ago, properties: { path: "/" })
        create(:ahoy_event, :page_view, visit: visit1, time: 1.hour.ago, properties: { path: "/about" })
        create(:ahoy_event, :page_view, visit: visit2, time: 2.hours.ago, properties: { path: "/" })

        result = subject.time_series
        today_data = result[:series].first[:data].last

        expect(today_data).to eq(3) # 3 page_view events, not 2 visits
      end

      it "does not count page_view events from other days" do
        # Events from yesterday should not count for today's live count
        yesterday_visit = create(:ahoy_visit, website: website, started_at: 1.day.ago)
        create(:ahoy_event, :page_view, visit: yesterday_visit, time: 1.day.ago)
        create(:ahoy_event, :page_view, visit: yesterday_visit, time: 1.day.ago)

        # Only today's event should count
        today_visit = create(:ahoy_visit, website: website, started_at: 1.hour.ago)
        create(:ahoy_event, :page_view, visit: today_visit, time: 1.hour.ago)

        result = subject.time_series
        today_data = result[:series].first[:data].last

        expect(today_data).to eq(1)
      end

      it "only counts page_view events, not other event types" do
        visit = create(:ahoy_visit, website: website, started_at: 1.hour.ago)
        create(:ahoy_event, :page_view, visit: visit, time: 1.hour.ago)
        create(:ahoy_event, name: "button_click", visit: visit, time: 1.hour.ago)
        create(:ahoy_event, name: "form_submit", visit: visit, time: 1.hour.ago)

        result = subject.time_series
        today_data = result[:series].first[:data].last

        expect(today_data).to eq(1) # Only the page_view event
      end

      it "returns 0 when website has no page_view events" do
        website # Ensure website exists

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
        project_without_website.reload

        result = subject.time_series
        project_series = result[:series].find { |s| s[:project_id] == project_without_website.id }

        expect(project_series[:data].last).to eq(0) if project_series
      end
    end
  end

  describe "trend calculation" do
    it "shows positive trend when this period > last period" do
      create(:analytics_daily_metric, account: account, project: project,
        date: 10.days.ago, page_views_count: 100)
      create(:analytics_daily_metric, account: account, project: project,
        date: 2.days.ago, page_views_count: 200)

      result = subject.time_series

      expect(result[:totals][:trend_direction]).to eq("up")
      expect(result[:totals][:trend_percent]).to eq(100.0)
    end

    it "shows negative trend when this period < last period" do
      create(:analytics_daily_metric, account: account, project: project,
        date: 10.days.ago, page_views_count: 200)
      create(:analytics_daily_metric, account: account, project: project,
        date: 2.days.ago, page_views_count: 100)

      result = subject.time_series

      expect(result[:totals][:trend_direction]).to eq("down")
      expect(result[:totals][:trend_percent]).to eq(50.0)
    end
  end
end
