# frozen_string_literal: true

require "rails_helper"

RSpec.describe Analytics::SyncService do
  # Freeze to 12:01am EST to test timezone handling
  # This ensures Date.yesterday and date range calculations are deterministic
  around do |example|
    Timecop.freeze(Time.new(2026, 1, 29, 0, 1, 0, "-05:00")) do
      example.run
    end
  end

  let(:account) { create(:account) }
  let!(:ads_account) { create(:ads_account, account: account, platform: "google", google_customer_id: "123-456-7890") }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project) }
  let!(:campaign) do
    c = create(:campaign, project: project, account: account, website: website)
    c.update_column(:platform_settings, { "google" => { "campaign_id" => "111222333" } })
    c
  end

  subject { described_class.new(ads_account) }

  describe "#sync_google_ads" do
    context "with valid google_customer_id" do
      let(:performance_data) do
        [
          {
            campaign_id: 111222333,
            date: Date.yesterday,
            impressions: 1000,
            clicks: 50,
            cost_micros: 25_000_000,
            conversions: 5.0,
            conversion_value_micros: 500_000_000
          }
        ]
      end

      before do
        mock_performance = instance_double(GoogleAds::Resources::CampaignPerformance)
        allow(GoogleAds::Resources::CampaignPerformance).to receive(:new)
          .with(ads_account)
          .and_return(mock_performance)
        allow(mock_performance).to receive(:fetch_daily_metrics)
          .with(start_date: 7.days.ago.to_date, end_date: Date.current)
          .and_return(performance_data)
      end

      it "creates ad_performance_daily records" do
        expect {
          subject.sync_google_ads
        }.to change(AdPerformanceDaily, :count).by(1)
      end

      it "returns the count of upserted records" do
        expect(subject.sync_google_ads).to eq(1)
      end

      it "stores correct values" do
        subject.sync_google_ads
        record = AdPerformanceDaily.last

        expect(record.campaign_id).to eq(campaign.id)
        expect(record.date).to eq(Date.yesterday)
        expect(record.impressions).to eq(1000)
        expect(record.clicks).to eq(50)
        expect(record.cost_micros).to eq(25_000_000)
        expect(record.conversions).to eq(5.0)
        expect(record.conversion_value_micros).to eq(500_000_000)
      end
    end

    context "without google_customer_id" do
      before do
        ads_account.update!(google_customer_id: nil)
      end

      it "returns 0 without making API calls" do
        expect(GoogleAds::Resources::CampaignPerformance).not_to receive(:new)
        expect(subject.sync_google_ads).to eq(0)
      end
    end

    context "with empty performance data" do
      before do
        mock_performance = instance_double(GoogleAds::Resources::CampaignPerformance)
        allow(GoogleAds::Resources::CampaignPerformance).to receive(:new).and_return(mock_performance)
        allow(mock_performance).to receive(:fetch_daily_metrics).and_return([])
      end

      it "returns 0" do
        expect(subject.sync_google_ads).to eq(0)
      end
    end

    context "with unmatched campaign IDs" do
      let(:performance_data) do
        [{ campaign_id: 999999999, date: Date.yesterday, impressions: 100, clicks: 5, cost_micros: 1000, conversions: 0, conversion_value_micros: 0 }]
      end

      before do
        mock_performance = instance_double(GoogleAds::Resources::CampaignPerformance)
        allow(GoogleAds::Resources::CampaignPerformance).to receive(:new).and_return(mock_performance)
        allow(mock_performance).to receive(:fetch_daily_metrics).and_return(performance_data)
      end

      it "skips records without matching local campaigns" do
        expect {
          subject.sync_google_ads
        }.not_to change(AdPerformanceDaily, :count)
      end
    end
  end
end
