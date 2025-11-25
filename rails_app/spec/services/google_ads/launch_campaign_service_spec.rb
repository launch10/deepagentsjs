require 'rails_helper'

RSpec.describe GoogleAds::LaunchCampaignService do
  describe '#call' do
    let(:customer_id) { ENV['GOOGLE_ADS_TEST_CUSTOMER_ID'] || '1234567890' }
    let(:campaign) { finish_settings_stage.first }

    before do
      # Set launch stage requirements
      campaign.update!(
        google_advertising_channel_type: "SEARCH",
        google_bidding_strategy: "TARGET_SPEND",
        start_date: Date.tomorrow,
        end_date: Date.today + 1.month
      )

      # Add language targeting
      campaign.language_targets.create!(
        language_code: "1000", # English
        language_name: "English"
      )
    end

    context 'when launching a complete campaign' do
      it 'creates all entities in Google Ads', :vcr do
        service = GoogleAds::LaunchCampaignService.new(campaign)
        result = service.call

        expect(result.success?).to be true
        expect(campaign.reload.google_campaign_id).to be_present
        expect(campaign.google_customer_id).to eq(customer_id)

        # Verify all entities were created
        expect(campaign.google_budget_id).to be_present
        expect(campaign.ad_groups.first.google_ad_group_id).to be_present
        expect(campaign.ad_groups.first.ads.first.google_ad_id).to be_present

        # Verify criteria were created
        campaign.ad_groups.first.keywords.each do |keyword|
          expect(keyword.google_criterion_id).to be_present
        end

        campaign.location_targets.each do |location|
          expect(location.google_criterion_id).to be_present
        end

        campaign.language_targets.each do |language|
          expect(language.google_criterion_id).to be_present
        end

        campaign.ad_schedules.each do |schedule|
          expect(schedule.google_criterion_id).to be_present unless schedule.always_on?
        end

        # Verify assets were created
        campaign.ad_groups.first.callouts.each do |callout|
          expect(callout.google_asset_id).to be_present
        end
      end
    end
  end
end
