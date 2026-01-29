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

    context "account isolation" do
      let(:other_account) { create(:account) }
      let!(:other_ads_account) { create(:ads_account, account: other_account, platform: "google", google_customer_id: "999-888-7777") }
      let(:other_project) { create(:project, account: other_account) }
      let(:other_website) { create(:website, project: other_project) }
      let!(:other_campaign) do
        c = create(:campaign, project: other_project, account: other_account, website: other_website)
        # Same Google campaign ID as the first account's campaign - should NOT collide
        c.update_column(:platform_settings, { "google" => { "campaign_id" => "111222333" } })
        c
      end

      let(:account_a_data) do
        [{
          campaign_id: 111222333,
          date: Date.yesterday,
          impressions: 1000,
          clicks: 50,
          cost_micros: 25_000_000,
          conversions: 5.0,
          conversion_value_micros: 500_000_000
        }]
      end

      let(:account_b_data) do
        [{
          campaign_id: 111222333, # Same Google campaign ID
          date: Date.yesterday,
          impressions: 2000,
          clicks: 100,
          cost_micros: 50_000_000,
          conversions: 10.0,
          conversion_value_micros: 1_000_000_000
        }]
      end

      it "does not mix data between accounts with same google campaign IDs" do
        # Sync Account A
        mock_a = instance_double(GoogleAds::Resources::CampaignPerformance)
        allow(GoogleAds::Resources::CampaignPerformance).to receive(:new).with(ads_account).and_return(mock_a)
        allow(mock_a).to receive(:fetch_daily_metrics).and_return(account_a_data)

        subject.perform(ads_account.id)

        # Sync Account B
        mock_b = instance_double(GoogleAds::Resources::CampaignPerformance)
        allow(GoogleAds::Resources::CampaignPerformance).to receive(:new).with(other_ads_account).and_return(mock_b)
        allow(mock_b).to receive(:fetch_daily_metrics).and_return(account_b_data)

        subject.perform(other_ads_account.id)

        # Each account should have its own record
        expect(AdPerformanceDaily.count).to eq(2)

        record_a = AdPerformanceDaily.find_by(campaign_id: campaign.id)
        record_b = AdPerformanceDaily.find_by(campaign_id: other_campaign.id)

        expect(record_a.impressions).to eq(1000)
        expect(record_a.clicks).to eq(50)

        expect(record_b.impressions).to eq(2000)
        expect(record_b.clicks).to eq(100)
      end

      it "does not overwrite Account A's data when syncing Account B" do
        # Sync Account A first
        mock_a = instance_double(GoogleAds::Resources::CampaignPerformance)
        allow(GoogleAds::Resources::CampaignPerformance).to receive(:new).with(ads_account).and_return(mock_a)
        allow(mock_a).to receive(:fetch_daily_metrics).and_return(account_a_data)
        subject.perform(ads_account.id)

        original_record = AdPerformanceDaily.find_by(campaign_id: campaign.id)
        expect(original_record.impressions).to eq(1000)

        # Sync Account B
        mock_b = instance_double(GoogleAds::Resources::CampaignPerformance)
        allow(GoogleAds::Resources::CampaignPerformance).to receive(:new).with(other_ads_account).and_return(mock_b)
        allow(mock_b).to receive(:fetch_daily_metrics).and_return(account_b_data)
        subject.perform(other_ads_account.id)

        # Account A's record should be unchanged
        original_record.reload
        expect(original_record.impressions).to eq(1000)
        expect(original_record.clicks).to eq(50)
      end
    end

    context "multiple campaigns under same account" do
      let!(:campaign_2) do
        c = create(:campaign, project: project, account: account, website: website)
        c.update_column(:platform_settings, { "google" => { "campaign_id" => "444555666" } })
        c
      end

      let(:multi_campaign_data) do
        [
          {
            campaign_id: 111222333,
            date: Date.yesterday,
            impressions: 1000,
            clicks: 50,
            cost_micros: 25_000_000,
            conversions: 5.0,
            conversion_value_micros: 500_000_000
          },
          {
            campaign_id: 444555666,
            date: Date.yesterday,
            impressions: 2000,
            clicks: 100,
            cost_micros: 50_000_000,
            conversions: 10.0,
            conversion_value_micros: 1_000_000_000
          }
        ]
      end

      before do
        mock_performance = instance_double(GoogleAds::Resources::CampaignPerformance)
        allow(GoogleAds::Resources::CampaignPerformance).to receive(:new).and_return(mock_performance)
        allow(mock_performance).to receive(:fetch_daily_metrics).and_return(multi_campaign_data)
      end

      it "creates records for all matched campaigns" do
        expect {
          subject.perform(ads_account.id)
        }.to change(AdPerformanceDaily, :count).by(2)
      end

      it "stores correct data for each campaign" do
        subject.perform(ads_account.id)

        record_1 = AdPerformanceDaily.find_by(campaign_id: campaign.id)
        record_2 = AdPerformanceDaily.find_by(campaign_id: campaign_2.id)

        expect(record_1.impressions).to eq(1000)
        expect(record_2.impressions).to eq(2000)
      end
    end

    context "multiple days in rolling window" do
      let(:multi_day_data) do
        (0..6).map do |days_ago|
          {
            campaign_id: 111222333,
            date: days_ago.days.ago.to_date,
            impressions: 1000 + (days_ago * 100),
            clicks: 50 + (days_ago * 5),
            cost_micros: 25_000_000,
            conversions: 5.0,
            conversion_value_micros: 500_000_000
          }
        end
      end

      before do
        mock_performance = instance_double(GoogleAds::Resources::CampaignPerformance)
        allow(GoogleAds::Resources::CampaignPerformance).to receive(:new).and_return(mock_performance)
        allow(mock_performance).to receive(:fetch_daily_metrics).and_return(multi_day_data)
      end

      it "creates records for each day" do
        expect {
          subject.perform(ads_account.id)
        }.to change(AdPerformanceDaily, :count).by(7)
      end

      it "stores correct data for each day" do
        subject.perform(ads_account.id)

        # Check yesterday's record
        yesterday_record = AdPerformanceDaily.find_by(campaign_id: campaign.id, date: 1.day.ago.to_date)
        expect(yesterday_record.impressions).to eq(1100)

        # Check oldest record (6 days ago)
        oldest_record = AdPerformanceDaily.find_by(campaign_id: campaign.id, date: 6.days.ago.to_date)
        expect(oldest_record.impressions).to eq(1600)
      end

      it "updates existing days without creating duplicates on re-sync" do
        subject.perform(ads_account.id)
        expect(AdPerformanceDaily.count).to eq(7)

        # Re-sync with updated data
        updated_data = multi_day_data.map { |d| d.merge(impressions: d[:impressions] + 500) }
        mock_performance = instance_double(GoogleAds::Resources::CampaignPerformance)
        allow(GoogleAds::Resources::CampaignPerformance).to receive(:new).and_return(mock_performance)
        allow(mock_performance).to receive(:fetch_daily_metrics).and_return(updated_data)

        expect {
          subject.perform(ads_account.id)
        }.not_to change(AdPerformanceDaily, :count)

        # Verify data was updated
        yesterday_record = AdPerformanceDaily.find_by(campaign_id: campaign.id, date: 1.day.ago.to_date)
        expect(yesterday_record.impressions).to eq(1600) # 1100 + 500
      end
    end

    context "unmatched campaign IDs" do
      let(:mixed_data) do
        [
          {
            campaign_id: 111222333, # Matches our campaign
            date: Date.yesterday,
            impressions: 1000,
            clicks: 50,
            cost_micros: 25_000_000,
            conversions: 5.0,
            conversion_value_micros: 500_000_000
          },
          {
            campaign_id: 999999999, # No matching local campaign
            date: Date.yesterday,
            impressions: 5000,
            clicks: 250,
            cost_micros: 100_000_000,
            conversions: 25.0,
            conversion_value_micros: 2_500_000_000
          }
        ]
      end

      before do
        mock_performance = instance_double(GoogleAds::Resources::CampaignPerformance)
        allow(GoogleAds::Resources::CampaignPerformance).to receive(:new).and_return(mock_performance)
        allow(mock_performance).to receive(:fetch_daily_metrics).and_return(mixed_data)
      end

      it "only creates records for matched campaigns" do
        expect {
          subject.perform(ads_account.id)
        }.to change(AdPerformanceDaily, :count).by(1)
      end

      it "does not fail on partial matches" do
        expect { subject.perform(ads_account.id) }.not_to raise_error
      end
    end

    context "edge case: zero values" do
      let(:zero_data) do
        [{
          campaign_id: 111222333,
          date: Date.yesterday,
          impressions: 0,
          clicks: 0,
          cost_micros: 0,
          conversions: 0.0,
          conversion_value_micros: 0
        }]
      end

      before do
        mock_performance = instance_double(GoogleAds::Resources::CampaignPerformance)
        allow(GoogleAds::Resources::CampaignPerformance).to receive(:new).and_return(mock_performance)
        allow(mock_performance).to receive(:fetch_daily_metrics).and_return(zero_data)
      end

      it "stores zero values correctly (not nil)" do
        subject.perform(ads_account.id)
        record = AdPerformanceDaily.last

        expect(record.impressions).to eq(0)
        expect(record.clicks).to eq(0)
        expect(record.cost_micros).to eq(0)
        expect(record.conversions).to eq(0.0)
        expect(record.conversion_value_micros).to eq(0)
      end
    end

    context "edge case: large values" do
      let(:large_data) do
        [{
          campaign_id: 111222333,
          date: Date.yesterday,
          impressions: 999_999_999_999,
          clicks: 50_000_000_000,
          cost_micros: 999_999_999_999_999, # ~$1 billion
          conversions: 1_000_000.99,
          conversion_value_micros: 999_999_999_999_999
        }]
      end

      before do
        mock_performance = instance_double(GoogleAds::Resources::CampaignPerformance)
        allow(GoogleAds::Resources::CampaignPerformance).to receive(:new).and_return(mock_performance)
        allow(mock_performance).to receive(:fetch_daily_metrics).and_return(large_data)
      end

      it "handles large values without overflow" do
        subject.perform(ads_account.id)
        record = AdPerformanceDaily.last

        expect(record.impressions).to eq(999_999_999_999)
        expect(record.clicks).to eq(50_000_000_000)
        expect(record.cost_micros).to eq(999_999_999_999_999)
        expect(record.conversions).to eq(1_000_000.99)
        expect(record.conversion_value_micros).to eq(999_999_999_999_999)
      end
    end
  end
end
