# frozen_string_literal: true

require "rails_helper"

RSpec.describe GoogleAds::SyncPerformanceWorker do
  let(:account) { create(:account) }
  let!(:ads_account) { create(:ads_account, account: account, platform: "google", google_customer_id: "123-456-7890") }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project) }
  let!(:campaign) do
    c = create(:campaign, project: project, account: account, website: website)
    c.update_column(:platform_settings, { "google" => { "campaign_id" => "111222333" } })
    c
  end

  describe "#perform" do
    context "7-day rolling window" do
      it "fetches last 7 days of data" do
        mock_performance = instance_double(GoogleAds::Resources::CampaignPerformance)
        expect(GoogleAds::Resources::CampaignPerformance).to receive(:new).with(ads_account).and_return(mock_performance)
        expect(mock_performance).to receive(:fetch_daily_metrics)
          .with(start_date: 7.days.ago.to_date, end_date: Date.yesterday)
          .and_return([])

        subject.perform
      end
    end

    context "with valid Google Ads connection" do
      let(:performance_data) do
        [
          {
            campaign_id: 111222333,
            campaign_name: campaign.name,
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
        allow(GoogleAds::Resources::CampaignPerformance).to receive(:new).and_return(mock_performance)
        allow(mock_performance).to receive(:fetch_daily_metrics).and_return(performance_data)
      end

      it "creates ad_performance_daily records" do
        expect {
          subject.perform
        }.to change(AdPerformanceDaily, :count).by(1)
      end

      it "stores raw values exactly as returned from API" do
        subject.perform
        record = AdPerformanceDaily.last

        expect(record.impressions).to eq(1000)
        expect(record.clicks).to eq(50)
        expect(record.cost_micros).to eq(25_000_000)
        expect(record.conversions).to eq(5.0)
        expect(record.conversion_value_micros).to eq(500_000_000)
      end

      it "upserts on conflict - updates existing records with new data" do
        # Simulate initial sync
        subject.perform

        # Simulate later sync with updated data (late-arriving conversions)
        updated_data = performance_data.map do |d|
          d.merge(conversions: 7.0, conversion_value_micros: 700_000_000)
        end

        mock_performance = instance_double(GoogleAds::Resources::CampaignPerformance)
        allow(GoogleAds::Resources::CampaignPerformance).to receive(:new).and_return(mock_performance)
        allow(mock_performance).to receive(:fetch_daily_metrics).and_return(updated_data)

        expect {
          subject.perform
        }.not_to change(AdPerformanceDaily, :count)

        record = AdPerformanceDaily.last
        expect(record.conversions).to eq(7.0)
        expect(record.conversion_value_micros).to eq(700_000_000)
      end
    end

    context "without google_customer_id" do
      before do
        ads_account.update!(google_customer_id: nil)
      end

      it "skips accounts without customer ID" do
        expect(GoogleAds::Resources::CampaignPerformance).not_to receive(:new)
        subject.perform
      end
    end

    context "error handling" do
      it "continues processing other accounts on individual failure" do
        ads_account2 = create(:ads_account, platform: "google", google_customer_id: "999-888-7777")

        mock_performance1 = instance_double(GoogleAds::Resources::CampaignPerformance)
        mock_performance2 = instance_double(GoogleAds::Resources::CampaignPerformance)

        allow(GoogleAds::Resources::CampaignPerformance).to receive(:new).with(ads_account).and_return(mock_performance1)
        allow(GoogleAds::Resources::CampaignPerformance).to receive(:new).with(ads_account2).and_return(mock_performance2)

        allow(mock_performance1).to receive(:fetch_daily_metrics).and_raise(StandardError.new("API error"))
        allow(mock_performance2).to receive(:fetch_daily_metrics).and_return([])

        expect { subject.perform }.not_to raise_error
      end
    end
  end
end
