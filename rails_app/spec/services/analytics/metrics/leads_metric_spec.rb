# frozen_string_literal: true

require "rails_helper"

RSpec.describe Analytics::Metrics::LeadsMetric do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project) }

  subject { described_class.new(account, 7.days.ago, Date.current) }

  describe "#time_series" do
    before do
      # Create pre-computed historical data
      create(:analytics_daily_metric, account: account, project: project,
             date: 3.days.ago, leads_count: 2)
      create(:analytics_daily_metric, account: account, project: project,
             date: 1.day.ago, leads_count: 1)
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

    it "includes current and previous totals" do
      result = subject.time_series
      expect(result[:totals]).to have_key(:current)
      expect(result[:totals]).to have_key(:previous)
    end
  end

  describe "live data for today" do
    let(:lead) { create(:lead, account: account, email: "test@example.com") }

    it "includes today's leads from website_leads" do
      create(:website_lead, website: website, lead: lead, created_at: 1.hour.ago)

      result = subject.time_series
      today_data = result[:series].first[:data].last

      expect(today_data).to eq(1)
    end
  end

  describe "trend calculation" do
    it "shows positive trend when this period > last period" do
      # Last period (8-14 days ago): 5 leads
      create(:analytics_daily_metric, account: account, project: project,
             date: 10.days.ago, leads_count: 5)

      # This period: 10 leads
      create(:analytics_daily_metric, account: account, project: project,
             date: 2.days.ago, leads_count: 10)

      result = subject.time_series

      expect(result[:totals][:trend_direction]).to eq("up")
      expect(result[:totals][:trend_percent]).to eq(100.0)
    end

    it "shows negative trend when this period < last period" do
      # Last period: 10 leads
      create(:analytics_daily_metric, account: account, project: project,
             date: 10.days.ago, leads_count: 10)

      # This period: 5 leads
      create(:analytics_daily_metric, account: account, project: project,
             date: 2.days.ago, leads_count: 5)

      result = subject.time_series

      expect(result[:totals][:trend_direction]).to eq("down")
      expect(result[:totals][:trend_percent]).to eq(50.0)
    end
  end
end
