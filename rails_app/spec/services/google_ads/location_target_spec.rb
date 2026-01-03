require 'rails_helper'

RSpec.describe GoogleAds::LocationTarget do
  include GoogleAdsMocks

  let(:account) { create(:account) }
  let(:campaign) { create(:campaign, account: account) }
  let(:ad_location_target) do
    create(:ad_location_target,
      campaign: campaign,
      target_type: "geo_location",
      location_name: "Chicago",
      country_code: "US",
      targeted: true,
      platform_settings: { "google" => { "criterion_id" => "geoTargetConstants/21167" } })
  end
  let(:location_target_syncer) { described_class.new(ad_location_target) }

  before do
    mock_google_ads_client
    allow(campaign).to receive(:google_customer_id).and_return("1234567890")
    allow(campaign).to receive(:google_campaign_id).and_return(789)
  end

  describe '#local_resource' do
    it 'returns the ad_location_target passed to the syncer' do
      expect(location_target_syncer.local_resource).to eq(ad_location_target)
    end
  end

  describe '#campaign' do
    it 'returns the campaign from the ad_location_target' do
      expect(location_target_syncer.campaign).to eq(campaign)
    end
  end

  describe '#fetch_remote' do
    let(:mock_campaign_criterion_service) { double("CampaignCriterionService") }

    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign_criterion: mock_campaign_criterion_service)
      )
    end

    context 'when criterion exists by ID' do
      before do
        ad_location_target.platform_settings["google"]["remote_criterion_id"] = 111
        ad_location_target.save!
      end

      it 'fetches the remote criterion by ID' do
        criterion_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        remote = location_target_syncer.fetch_remote
        expect(remote.criterion_id).to eq(111)
        expect(remote.location.geo_target_constant).to eq("geoTargetConstants/21167")
      end
    end

    context 'when criterion does not exist remotely' do
      it 'returns nil' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        expect(location_target_syncer.fetch_remote).to be_nil
      end
    end
  end

  describe '#sync_result' do
    let(:mock_campaign_criterion_service) { double("CampaignCriterionService") }

    before do
      ad_location_target.platform_settings["google"]["remote_criterion_id"] = 111
      ad_location_target.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign_criterion: mock_campaign_criterion_service)
      )
    end

    context 'when remote criterion exists and matches local' do
      it 'returns synced result' do
        criterion_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        result = location_target_syncer.sync_result
        expect(result.synced?).to be true
        expect(result.action).to eq(:unchanged)
        expect(result.resource_type).to eq(:campaign_criterion)
      end
    end

    context 'when remote criterion exists but does not match local (negative mismatch)' do
      before do
        ad_location_target.targeted = false
        ad_location_target.save!
      end

      it 'returns unsynced result with mismatched fields' do
        criterion_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        result = location_target_syncer.sync_result
        expect(result.synced?).to be false
        expect(result.values_match?).to be false
        expect(result.mismatched_fields.map(&:our_field)).to include(:negative)
      end
    end

    context 'when remote criterion does not exist' do
      before do
        ad_location_target.platform_settings["google"].delete("remote_criterion_id")
        ad_location_target.save!
      end

      it 'returns not_found result' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        result = location_target_syncer.sync_result
        expect(result.not_found?).to be true
        expect(result.synced?).to be false
      end
    end
  end

  describe '#synced?' do
    let(:mock_campaign_criterion_service) { double("CampaignCriterionService") }

    before do
      ad_location_target.platform_settings["google"]["remote_criterion_id"] = 111
      ad_location_target.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign_criterion: mock_campaign_criterion_service)
      )
    end

    it 'returns true when values match' do
      criterion_response = mock_search_response_with_campaign_criterion(
        criterion_id: 111,
        campaign_id: 789,
        customer_id: 1234567890,
        location_id: 21167,
        negative: false
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

      expect(location_target_syncer.synced?).to be true
    end

    it 'returns false when values do not match' do
      criterion_response = mock_search_response_with_campaign_criterion(
        criterion_id: 111,
        campaign_id: 789,
        customer_id: 1234567890,
        location_id: 21167,
        negative: true
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

      expect(location_target_syncer.synced?).to be false
    end
  end

  describe '#sync' do
    let(:mock_campaign_criterion_service) { double("CampaignCriterionService") }
    let(:mock_create_resource) { double("CreateResource") }

    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign_criterion: mock_campaign_criterion_service)
      )
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    context 'when already synced' do
      before do
        ad_location_target.platform_settings["google"]["remote_criterion_id"] = 111
        ad_location_target.save!
      end

      it 'returns sync_result without making API calls' do
        criterion_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        expect(mock_campaign_criterion_service).not_to receive(:mutate_campaign_criteria)
        result = location_target_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end

    context 'when remote criterion does not exist' do
      before do
        ad_location_target.platform_settings["google"].delete("remote_criterion_id")
        ad_location_target.save!
      end

      it 'creates a new criterion and verifies sync' do
        created_criterion_response = mock_search_response_with_campaign_criterion(
          criterion_id: 222,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response, created_criterion_response)

        mock_criterion = mock_campaign_criterion_resource
        mock_location_info = double("LocationInfo")
        allow(mock_location_info).to receive(:geo_target_constant=)
        allow(@mock_resource).to receive(:location_info).and_yield(mock_location_info).and_return(mock_location_info)
        allow(mock_create_resource).to receive(:campaign_criterion).and_yield(mock_criterion)

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 222, campaign_id: 789, customer_id: 1234567890)
        allow(mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_return(mutate_response)

        result = location_target_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.created?).to be true
        expect(result.resource_name).to eq("customers/1234567890/campaignCriteria/789~222")
        expect(result.synced?).to be true
        expect(location_target_syncer.local_resource.google_remote_criterion_id).to eq(222)
      end

      it 'returns error result when API call fails' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        mock_criterion = mock_campaign_criterion_resource
        mock_location_info = double("LocationInfo")
        allow(mock_location_info).to receive(:geo_target_constant=)
        allow(@mock_resource).to receive(:location_info).and_yield(mock_location_info).and_return(mock_location_info)
        allow(mock_create_resource).to receive(:campaign_criterion).and_yield(mock_criterion)

        allow(mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_raise(mock_google_ads_error(message: "Criterion creation failed"))

        result = location_target_syncer.sync
        expect(result.error?).to be true
      end
    end

    context 'when remote criterion exists but needs update (negative changed)' do
      before do
        ad_location_target.platform_settings["google"]["remote_criterion_id"] = 111
        ad_location_target.targeted = false
        ad_location_target.save!
      end

      it 'updates the criterion with the new negative value' do
        mismatched_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false
        )
        synced_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: true
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mismatched_response, synced_response)

        mock_criterion = mock_campaign_criterion_resource
        allow(@mock_update_resource).to receive(:campaign_criterion)
          .with("customers/1234567890/campaignCriteria/789~111")
          .and_yield(mock_criterion)

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 111, campaign_id: 789, customer_id: 1234567890)
        allow(mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_return(mutate_response)

        result = location_target_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.updated?).to be true
        expect(result.synced?).to be true
      end
    end
  end

  describe '#delete' do
    let(:mock_campaign_criterion_service) { double("CampaignCriterionService") }

    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign_criterion: mock_campaign_criterion_service)
      )
    end

    context 'when remote criterion does not exist' do
      before do
        ad_location_target.platform_settings["google"].delete("remote_criterion_id")
        ad_location_target.save!
      end

      it 'returns not_found result' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        result = location_target_syncer.delete
        expect(result.not_found?).to be true
        expect(result.resource_type).to eq(:campaign_criterion)
      end
    end

    context 'when remote criterion exists' do
      before do
        ad_location_target.platform_settings["google"]["remote_criterion_id"] = 111
        ad_location_target.save!
      end

      it 'deletes the criterion and returns deleted result' do
        criterion_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign_criterion)
          .with("customers/1234567890/campaignCriteria/789~111")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 111, campaign_id: 789, customer_id: 1234567890)
        allow(mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_return(mutate_response)

        result = location_target_syncer.delete
        expect(result.deleted?).to be true
        expect(result.resource_type).to eq(:campaign_criterion)
        expect(location_target_syncer.local_resource.google_remote_criterion_id).to be_nil
      end

      it 'persists the nil google_remote_criterion_id to the database' do
        criterion_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign_criterion)
          .with("customers/1234567890/campaignCriteria/789~111")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 111, campaign_id: 789, customer_id: 1234567890)
        allow(mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_return(mutate_response)

        location_target_syncer.delete

        fresh_target = AdLocationTarget.find(ad_location_target.id)
        expect(fresh_target.google_remote_criterion_id).to be_nil
      end

      it 'returns error result when API call fails' do
        criterion_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign_criterion)
          .with("customers/1234567890/campaignCriteria/789~111")
          .and_return(mock_remove_operation)

        allow(mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_raise(mock_google_ads_error(message: "Criterion deletion failed"))

        result = location_target_syncer.delete
        expect(result.error?).to be true
      end
    end
  end

  describe 'AdLocationTarget helper methods' do
    let(:mock_campaign_criterion_service) { double("CampaignCriterionService") }

    before do
      ad_location_target.platform_settings["google"]["remote_criterion_id"] = 111
      ad_location_target.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign_criterion: mock_campaign_criterion_service)
      )
    end

    describe '#google_synced?' do
      it 'delegates to the syncer' do
        criterion_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        expect(ad_location_target.google_synced?).to be true
      end
    end

    describe '#google_sync_result' do
      it 'returns the sync result' do
        criterion_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        result = ad_location_target.google_sync_result
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end

    describe '#google_sync' do
      it 'syncs the location target' do
        criterion_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        result = ad_location_target.google_sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end
  end

  describe 'after_google_sync callback' do
    let(:mock_campaign_criterion_service) { double("CampaignCriterionService") }
    let(:mock_create_resource) { double("CreateResource") }

    before do
      ad_location_target.platform_settings["google"].delete("remote_criterion_id")
      ad_location_target.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign_criterion: mock_campaign_criterion_service)
      )
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    it 'sets google_remote_criterion_id from resource_name after sync' do
      created_criterion_response = mock_search_response_with_campaign_criterion(
        criterion_id: 444,
        campaign_id: 789,
        customer_id: 1234567890,
        location_id: 21167,
        negative: false
      )

      allow(@mock_google_ads_service).to receive(:search)
        .and_return(mock_empty_search_response, created_criterion_response)

      mock_criterion = mock_campaign_criterion_resource
      mock_location_info = double("LocationInfo")
      allow(mock_location_info).to receive(:geo_target_constant=)
      allow(@mock_resource).to receive(:location_info).and_yield(mock_location_info).and_return(mock_location_info)
      allow(mock_create_resource).to receive(:campaign_criterion).and_yield(mock_criterion)

      mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 444, campaign_id: 789, customer_id: 1234567890)
      allow(mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
        .and_return(mutate_response)

      ad_location_target.google_sync
      expect(ad_location_target.reload.google_remote_criterion_id).to eq("444")
    end

    it 'persists the google_remote_criterion_id to the database' do
      created_criterion_response = mock_search_response_with_campaign_criterion(
        criterion_id: 555,
        campaign_id: 789,
        customer_id: 1234567890,
        location_id: 21167,
        negative: false
      )

      allow(@mock_google_ads_service).to receive(:search)
        .and_return(mock_empty_search_response, created_criterion_response)

      mock_criterion = mock_campaign_criterion_resource
      mock_location_info = double("LocationInfo")
      allow(mock_location_info).to receive(:geo_target_constant=)
      allow(@mock_resource).to receive(:location_info).and_yield(mock_location_info).and_return(mock_location_info)
      allow(mock_create_resource).to receive(:campaign_criterion).and_yield(mock_criterion)

      mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 555, campaign_id: 789, customer_id: 1234567890)
      allow(mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
        .and_return(mutate_response)

      ad_location_target.google_sync

      fresh_target = AdLocationTarget.find(ad_location_target.id)
      expect(fresh_target.google_remote_criterion_id).to eq("555")
    end
  end
end
