# frozen_string_literal: true

require "rails_helper"

RSpec.describe Analytics::Metrics::GoogleAdsMetric do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project) }
  let(:campaign) { create(:campaign, project: project, account: account, website: website) }

  subject { described_class.new(account, 7.days.ago, Date.current) }

  describe "graceful degradation" do
    context "when no ads account connected" do
      it "returns available: false for CTR" do
        result = subject.ctr_time_series
        expect(result[:available]).to be false
        expect(result[:message]).to include("Connect Google Ads")
      end

      it "returns available: false for CPL" do
        result = subject.cpl_time_series
        expect(result[:available]).to be false
      end
    end

    context "when ads account exists but no campaigns" do
      before { create(:ads_account, account: account) }

      it "returns available: false with appropriate message" do
        result = subject.ctr_time_series
        expect(result[:available]).to be false
        expect(result[:message]).to include("Create a campaign")
      end
    end

    context "when campaigns exist but no performance data" do
      before do
        create(:ads_account, account: account)
        campaign # Create campaign but no performance data
      end

      it "returns available: false" do
        result = subject.ctr_time_series
        expect(result[:available]).to be false
        expect(result[:message]).to include("No performance data")
      end
    end

    context "when performance data exists" do
      before do
        create(:ads_account, account: account)
        create(:ad_performance_daily, campaign: campaign,
               date: 3.days.ago, impressions: 1000, clicks: 50)
      end

      it "returns available: true with data" do
        result = subject.ctr_time_series
        expect(result[:available]).to be true
        expect(result[:series]).not_to be_empty
      end
    end
  end

  describe "#ctr_time_series" do
    before do
      create(:ads_account, account: account)
      create(:ad_performance_daily, campaign: campaign,
             date: 3.days.ago, impressions: 1000, clicks: 50)
    end

    it "calculates CTR correctly" do
      result = subject.ctr_time_series

      # Find the day with data
      day_index = result[:dates].index(3.days.ago.to_date.iso8601)
      ctr_value = result[:series].first[:data][day_index]

      expect(ctr_value).to eq(5.0) # 50/1000 * 100 = 5%
    end

    it "returns 0 for days with no data" do
      result = subject.ctr_time_series

      # Check a day with no data
      day_index = result[:dates].index(1.day.ago.to_date.iso8601)
      expect(result[:series].first[:data][day_index]).to eq(0.0)
    end
  end

  describe "#cpl_time_series" do
    let(:lead) { create(:lead, account: account, email: "test@example.com") }

    before do
      create(:ads_account, account: account)
      create(:ad_performance_daily, campaign: campaign,
             date: 3.days.ago, cost_micros: 50_000_000) # $50
      create(:website_lead, website: website, lead: lead, created_at: 3.days.ago)
      create(:website_lead, website: website, lead: create(:lead, account: account, email: "test2@example.com"), created_at: 3.days.ago)
    end

    it "calculates cost per lead correctly" do
      result = subject.cpl_time_series

      # $50 / 2 leads = $25 CPL
      day_index = result[:dates].index(3.days.ago.to_date.iso8601)
      cpl_value = result[:series].first[:data][day_index]

      expect(cpl_value).to eq(25.0)
    end
  end

  describe "CPL trend direction" do
    # For CPL, lower is better, so trend direction should be inverted
    before do
      create(:ads_account, account: account)
      # Previous period: $50 CPL (10 days ago)
      create(:ad_performance_daily, campaign: campaign,
             date: 10.days.ago, cost_micros: 50_000_000)

      # Current period: $25 CPL (3 days ago)
      create(:ad_performance_daily, campaign: campaign,
             date: 3.days.ago, cost_micros: 25_000_000)
    end

    it "shows 'up' trend when CPL decreases (which is good)" do
      # Create leads for both periods
      lead1 = create(:lead, account: account, email: "lead1@example.com")
      lead2 = create(:lead, account: account, email: "lead2@example.com")
      create(:website_lead, website: website, lead: lead1, created_at: 10.days.ago)
      create(:website_lead, website: website, lead: lead2, created_at: 3.days.ago)

      result = subject.cpl_time_series

      # Current CPL: $25, Previous CPL: $50
      # Since lower is better, this should show as "up" (improvement)
      expect(result[:totals][:trend_direction]).to eq("up")
    end
  end
end
