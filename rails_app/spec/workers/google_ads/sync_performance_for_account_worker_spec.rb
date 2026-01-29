# frozen_string_literal: true

require "rails_helper"

RSpec.describe GoogleAds::SyncPerformanceForAccountWorker do
  # Freeze to 12:01am EST to test timezone handling
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

  describe "#perform" do
    it "calls SyncService" do
      service = instance_double(Analytics::SyncService)
      expect(Analytics::SyncService).to receive(:new)
        .with(ads_account)
        .and_return(service)
      expect(service).to receive(:sync_google_ads)

      subject.perform(ads_account.id)
    end

    context "integration" do
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
          subject.perform(ads_account.id)
        }.to change(AdPerformanceDaily, :count).by(1)
      end

      it "stores raw values exactly as returned from API" do
        subject.perform(ads_account.id)
        record = AdPerformanceDaily.last

        expect(record.impressions).to eq(1000)
        expect(record.clicks).to eq(50)
        expect(record.cost_micros).to eq(25_000_000)
        expect(record.conversions).to eq(5.0)
        expect(record.conversion_value_micros).to eq(500_000_000)
      end

      it "upserts on conflict - updates existing records" do
        subject.perform(ads_account.id)

        updated_data = performance_data.map do |d|
          d.merge(conversions: 7.0, conversion_value_micros: 700_000_000)
        end

        mock_performance = instance_double(GoogleAds::Resources::CampaignPerformance)
        allow(GoogleAds::Resources::CampaignPerformance).to receive(:new).and_return(mock_performance)
        allow(mock_performance).to receive(:fetch_daily_metrics).and_return(updated_data)

        expect {
          subject.perform(ads_account.id)
        }.not_to change(AdPerformanceDaily, :count)

        record = AdPerformanceDaily.last
        expect(record.conversions).to eq(7.0)
        expect(record.conversion_value_micros).to eq(700_000_000)
      end
    end
  end
end
