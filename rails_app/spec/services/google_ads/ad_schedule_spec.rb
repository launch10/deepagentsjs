require 'rails_helper'

RSpec.describe GoogleAds::AdSchedule do
  include GoogleAdsMocks

  let(:account) { create(:account) }
  let(:campaign) { create(:campaign, account: account) }
  let(:ad_schedule) do
    create(:ad_schedule,
      campaign: campaign,
      day_of_week: "Monday",
      start_hour: 9,
      start_minute: 0,
      end_hour: 17,
      end_minute: 0)
  end
  let(:ad_schedule_syncer) { described_class.new(ad_schedule) }

  before do
    mock_google_ads_client
    allow(campaign).to receive(:google_customer_id).and_return("1234567890")
    allow(campaign).to receive(:google_campaign_id).and_return(789)
  end

  describe '#local_resource' do
    it 'returns the ad_schedule passed to the syncer' do
      expect(ad_schedule_syncer.local_resource).to eq(ad_schedule)
    end
  end

  describe '#campaign' do
    it 'returns the campaign from the ad_schedule' do
      expect(ad_schedule_syncer.campaign).to eq(campaign)
    end
  end

  describe '#sync_result' do
    before do
      ad_schedule.platform_settings["google"] = { "criterion_id" => 222 }
      ad_schedule.save!
    end

    context 'when remote criterion exists and matches local' do
      it 'returns synced result' do
        criterion_response = mock_search_response_with_ad_schedule(
          criterion_id: 222,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :MONDAY,
          start_hour: 9,
          start_minute: :ZERO,
          end_hour: 17,
          end_minute: :ZERO
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        result = ad_schedule_syncer.sync_result
        expect(result.synced?).to be true
        expect(result.action).to eq(:unchanged)
        expect(result.resource_type).to eq(:campaign_criterion)
      end
    end

    context 'when remote criterion exists but does not match local (time mismatch)' do
      it 'returns unsynced result with mismatched fields' do
        criterion_response = mock_search_response_with_ad_schedule(
          criterion_id: 222,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :MONDAY,
          start_hour: 8,
          start_minute: :ZERO,
          end_hour: 17,
          end_minute: :ZERO
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        result = ad_schedule_syncer.sync_result
        expect(result.synced?).to be false
        expect(result.values_match?).to be false
        expect(result.mismatched_fields.map(&:our_field)).to include(:start_hour)
      end
    end

    context 'when remote criterion does not exist' do
      before do
        ad_schedule.platform_settings["google"].delete("criterion_id")
        ad_schedule.save!
      end

      it 'returns not_found result' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        result = ad_schedule_syncer.sync_result
        expect(result.not_found?).to be true
        expect(result.synced?).to be false
      end
    end
  end

  describe '#synced?' do
    before do
      ad_schedule.platform_settings["google"] = { "criterion_id" => 222 }
      ad_schedule.save!
    end

    it 'returns true when values match' do
      criterion_response = mock_search_response_with_ad_schedule(
        criterion_id: 222,
        campaign_id: 789,
        customer_id: 1234567890,
        day_of_week: :MONDAY,
        start_hour: 9,
        start_minute: :ZERO,
        end_hour: 17,
        end_minute: :ZERO
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

      expect(ad_schedule_syncer.synced?).to be true
    end

    it 'returns false when values do not match' do
      criterion_response = mock_search_response_with_ad_schedule(
        criterion_id: 222,
        campaign_id: 789,
        customer_id: 1234567890,
        day_of_week: :TUESDAY,
        start_hour: 9,
        start_minute: :ZERO,
        end_hour: 17,
        end_minute: :ZERO
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

      expect(ad_schedule_syncer.synced?).to be false
    end
  end

  describe '#sync' do
    let(:mock_create_resource) { double("CreateResource") }

    before do
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    context 'when already synced' do
      before do
        ad_schedule.platform_settings["google"] = { "criterion_id" => 222 }
        ad_schedule.save!
      end

      it 'returns sync_result without making API calls' do
        criterion_response = mock_search_response_with_ad_schedule(
          criterion_id: 222,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :MONDAY,
          start_hour: 9,
          start_minute: :ZERO,
          end_hour: 17,
          end_minute: :ZERO
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        expect(@mock_campaign_criterion_service).not_to receive(:mutate_campaign_criteria)
        result = ad_schedule_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end

    context 'when remote criterion does not exist' do
      before do
        ad_schedule.platform_settings["google"] = {}
        ad_schedule.save!
      end

      it 'creates a new criterion with correct attributes' do
        created_criterion_response = mock_search_response_with_ad_schedule(
          criterion_id: 333,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :MONDAY,
          start_hour: 9,
          start_minute: :ZERO,
          end_hour: 17,
          end_minute: :ZERO
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response, created_criterion_response)

        mock_criterion = mock_campaign_criterion_with_ad_schedule_resource
        mock_ad_schedule_info = mock_ad_schedule_info_resource

        expect(mock_criterion).to receive(:campaign=).with("customers/1234567890/campaigns/789")
        expect(mock_criterion).to receive(:ad_schedule=).with(mock_ad_schedule_info)

        expect(mock_ad_schedule_info).to receive(:day_of_week=).with(:MONDAY)
        expect(mock_ad_schedule_info).to receive(:start_hour=).with(9)
        expect(mock_ad_schedule_info).to receive(:start_minute=).with(:ZERO)
        expect(mock_ad_schedule_info).to receive(:end_hour=).with(17)
        expect(mock_ad_schedule_info).to receive(:end_minute=).with(:ZERO)

        allow(@mock_resource).to receive(:ad_schedule_info).and_yield(mock_ad_schedule_info).and_return(mock_ad_schedule_info)
        allow(mock_create_resource).to receive(:campaign_criterion).and_yield(mock_criterion)

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 333, campaign_id: 789, customer_id: 1234567890)
        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_return(mutate_response)

        result = ad_schedule_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.created?).to be true
        expect(result.resource_name).to eq("customers/1234567890/campaignCriteria/789~333")
        expect(result.synced?).to be true
        expect(ad_schedule_syncer.local_resource.google_criterion_id).to eq(333)
      end

      it 'returns error result when API call fails' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        mock_criterion = mock_campaign_criterion_with_ad_schedule_resource
        mock_ad_schedule_info = mock_ad_schedule_info_resource
        allow(@mock_resource).to receive(:ad_schedule_info).and_yield(mock_ad_schedule_info).and_return(mock_ad_schedule_info)
        allow(mock_create_resource).to receive(:campaign_criterion).and_yield(mock_criterion)

        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_raise(mock_google_ads_error(message: "Ad schedule creation failed"))

        result = ad_schedule_syncer.sync
        expect(result.error?).to be true
      end
    end

    context 'when remote criterion exists but needs update (time changed)' do
      before do
        ad_schedule.platform_settings["google"] = { "criterion_id" => 222 }
        ad_schedule.start_hour = 10
        ad_schedule.save!
      end

      it 'recreates the criterion since campaign criteria cannot be updated for ad_schedule' do
        mismatched_response = mock_search_response_with_ad_schedule(
          criterion_id: 222,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :MONDAY,
          start_hour: 9,
          start_minute: :ZERO,
          end_hour: 17,
          end_minute: :ZERO
        )
        recreated_criterion_response = mock_search_response_with_ad_schedule(
          criterion_id: 444,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :MONDAY,
          start_hour: 10,
          start_minute: :ZERO,
          end_hour: 17,
          end_minute: :ZERO
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mismatched_response, recreated_criterion_response)

        mock_criterion = mock_campaign_criterion_with_ad_schedule_resource
        mock_ad_schedule_info = mock_ad_schedule_info_resource
        allow(@mock_resource).to receive(:ad_schedule_info).and_yield(mock_ad_schedule_info).and_return(mock_ad_schedule_info)
        allow(mock_create_resource).to receive(:campaign_criterion).and_yield(mock_criterion)

        remove_operation = double("RemoveOperation")
        allow(@mock_operation).to receive(:remove_resource).and_return(remove_operation)
        allow(remove_operation).to receive(:campaign_criterion).and_return("remove_op")

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 444, campaign_id: 789, customer_id: 1234567890)
        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_return(mutate_response)

        result = ad_schedule_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.updated?).to be true
        expect(result.synced?).to be true
        expect(ad_schedule_syncer.local_resource.google_criterion_id).to eq(444)
      end
    end
  end

  describe 'AdSchedule model helper methods' do
    before do
      ad_schedule.platform_settings["google"] = { "criterion_id" => 222 }
      ad_schedule.save!
    end

    describe '#google_synced?' do
      it 'delegates to the syncer' do
        criterion_response = mock_search_response_with_ad_schedule(
          criterion_id: 222,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :MONDAY,
          start_hour: 9,
          start_minute: :ZERO,
          end_hour: 17,
          end_minute: :ZERO
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        expect(ad_schedule.google_synced?).to be true
      end
    end

    describe '#google_sync_result' do
      it 'returns the sync result' do
        criterion_response = mock_search_response_with_ad_schedule(
          criterion_id: 222,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :MONDAY,
          start_hour: 9,
          start_minute: :ZERO,
          end_hour: 17,
          end_minute: :ZERO
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        result = ad_schedule.google_sync_result
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end

    describe '#google_sync' do
      it 'syncs the ad schedule' do
        criterion_response = mock_search_response_with_ad_schedule(
          criterion_id: 222,
          campaign_id: 789,
          customer_id: 1234567890,
          day_of_week: :MONDAY,
          start_hour: 9,
          start_minute: :ZERO,
          end_hour: 17,
          end_minute: :ZERO
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        result = ad_schedule.google_sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end
  end
end
