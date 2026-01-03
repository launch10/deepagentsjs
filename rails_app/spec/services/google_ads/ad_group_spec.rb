require 'rails_helper'

RSpec.describe GoogleAds::AdGroup do
  include GoogleAdsMocks

  let(:account) { create(:account) }
  let(:campaign) { create(:campaign, account: account) }
  let(:ad_group) do
    create(:ad_group,
      name: "Test Ad Group",
      campaign: campaign,
      platform_settings: {})
  end
  let(:ad_group_syncer) { described_class.new(ad_group) }

  before do
    mock_google_ads_client
    allow(ad_group).to receive(:google_customer_id).and_return("1234567890")
    allow(campaign).to receive(:google_customer_id).and_return("1234567890")
    allow(campaign).to receive(:google_campaign_id).and_return(789)
  end

  describe '#local_resource' do
    it 'returns the ad_group passed to the syncer' do
      expect(ad_group_syncer.local_resource).to eq(ad_group)
    end
  end

  describe '#campaign' do
    it 'returns the campaign from the ad_group' do
      expect(ad_group_syncer.campaign).to eq(campaign)
    end
  end

  describe '#fetch_remote' do
    context 'when ad_group exists by ID' do
      before do
        ad_group.google_ad_group_id = 999
        ad_group.save!
      end

      it 'fetches the remote ad_group by ID' do
        ad_group_response = mock_search_response_with_ad_group(customer_id: 1234567890,
          ad_group_id: 999,
          name: "Test Ad Group",
          status: :PAUSED,
          type: :SEARCH_STANDARD,
          cpc_bid_micros: 1_000_000)
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_group_response)

        remote = ad_group_syncer.fetch_remote
        expect(remote.id).to eq(999)
        expect(remote.name).to eq("Test Ad Group")
      end
    end

    context 'when ad_group exists by name (fallback)' do
      it 'fetches the remote ad_group by name and sets the ID' do
        ad_group_response = mock_search_response_with_ad_group(customer_id: 1234567890,
          ad_group_id: 888,
          name: "Test Ad Group",
          status: :PAUSED,
          type: :SEARCH_STANDARD,
          cpc_bid_micros: 1_000_000)
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_group_response)

        remote = ad_group_syncer.fetch_remote
        expect(remote.id).to eq(888)
        expect(ad_group.google_ad_group_id).to eq(888)
      end
    end

    context 'when ad_group does not exist remotely' do
      it 'returns nil' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        expect(ad_group_syncer.fetch_remote).to be_nil
      end
    end
  end

  describe '#sync_result' do
    before do
      ad_group.google_ad_group_id = 999
      ad_group.save!
    end

    context 'when remote ad_group exists and matches local' do
      it 'returns synced result' do
        ad_group_response = mock_search_response_with_ad_group(customer_id: 1234567890,
          ad_group_id: 999,
          name: "Test Ad Group",
          status: :PAUSED,
          type: :SEARCH_STANDARD,
          cpc_bid_micros: 1_000_000)
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_group_response)

        result = ad_group_syncer.sync_result
        expect(result.synced?).to be true
        expect(result.action).to eq(:unchanged)
        expect(result.resource_type).to eq(:ad_group)
      end
    end

    context 'when remote ad_group exists but name does not match' do
      it 'returns unsynced result with mismatched fields' do
        ad_group_response = mock_search_response_with_ad_group(customer_id: 1234567890,
          ad_group_id: 999,
          name: "Different Name",
          status: :PAUSED,
          type: :SEARCH_STANDARD,
          cpc_bid_micros: 1_000_000)
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_group_response)

        result = ad_group_syncer.sync_result
        expect(result.synced?).to be false
        expect(result.values_match?).to be false
        expect(result.mismatched_fields.map(&:our_field)).to include(:name)
      end
    end

    context 'when remote ad_group does not exist' do
      before do
        ad_group.google_ad_group_id = nil
        ad_group.save!
      end

      it 'returns not_found result' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        result = ad_group_syncer.sync_result
        expect(result.not_found?).to be true
        expect(result.synced?).to be false
      end
    end
  end

  describe '#synced?' do
    before do
      ad_group.google_ad_group_id = 999
      ad_group.save!
    end

    it 'returns true when values match' do
      ad_group_response = mock_search_response_with_ad_group(customer_id: 1234567890,
        ad_group_id: 999,
        name: "Test Ad Group",
        status: :PAUSED,
        type: :SEARCH_STANDARD,
        cpc_bid_micros: 1_000_000)
      allow(@mock_google_ads_service).to receive(:search).and_return(ad_group_response)

      expect(ad_group_syncer.synced?).to be true
    end

    it 'returns false when values do not match' do
      ad_group_response = mock_search_response_with_ad_group(customer_id: 1234567890,
        ad_group_id: 999,
        name: "Different Name",
        status: :PAUSED,
        type: :SEARCH_STANDARD,
        cpc_bid_micros: 1_000_000)
      allow(@mock_google_ads_service).to receive(:search).and_return(ad_group_response)

      expect(ad_group_syncer.synced?).to be false
    end
  end

  describe '#sync' do
    let(:mock_create_resource) { double("CreateResource") }

    before do
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    context 'when already synced' do
      before do
        ad_group.google_ad_group_id = 999
        ad_group.save!
      end

      it 'returns sync_result without making API calls' do
        ad_group_response = mock_search_response_with_ad_group(customer_id: 1234567890,
          ad_group_id: 999,
          name: "Test Ad Group",
          status: :PAUSED,
          type: :SEARCH_STANDARD,
          cpc_bid_micros: 1_000_000)
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_group_response)

        expect(@mock_ad_group_service).not_to receive(:mutate_ad_groups)
        result = ad_group_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end

    context 'when remote ad_group does not exist' do
      it 'creates a new ad_group and verifies sync' do
        created_ad_group_response = mock_search_response_with_ad_group(customer_id: 1234567890,
          ad_group_id: 1001,
          name: "Test Ad Group",
          status: :PAUSED,
          type: :SEARCH_STANDARD,
          cpc_bid_micros: 1_000_000)

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response, created_ad_group_response)

        mock_ad_group = mock_ad_group_resource
        allow(mock_create_resource).to receive(:ad_group).and_yield(mock_ad_group)

        mutate_response = mock_mutate_ad_group_response(ad_group_id: 1001, customer_id: 1234567890)
        allow(@mock_ad_group_service).to receive(:mutate_ad_groups)
          .and_return(mutate_response)

        result = ad_group_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.created?).to be true
        expect(result.resource_name).to eq("customers/1234567890/adGroups/1001")
        expect(result.synced?).to be true
        expect(ad_group_syncer.local_resource.google_ad_group_id).to eq(1001)
      end

      it 'returns error result when API call fails' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        mock_ad_group = mock_ad_group_resource
        allow(mock_create_resource).to receive(:ad_group).and_yield(mock_ad_group)

        allow(@mock_ad_group_service).to receive(:mutate_ad_groups)
          .and_raise(mock_google_ads_error(message: "Ad group creation failed"))

        result = ad_group_syncer.sync
        expect(result.error?).to be true
      end
    end

    context 'when remote ad_group exists but needs update (name changed)' do
      before do
        ad_group.google_ad_group_id = 999
        ad_group.name = "Updated Ad Group Name"
        ad_group.save!
      end

      it 'updates the ad_group with the new name' do
        mismatched_response = mock_search_response_with_ad_group(customer_id: 1234567890,
          ad_group_id: 999,
          name: "Test Ad Group",
          status: :PAUSED,
          type: :SEARCH_STANDARD,
          cpc_bid_micros: 1_000_000)
        synced_response = mock_search_response_with_ad_group(customer_id: 1234567890,
          ad_group_id: 999,
          name: "Updated Ad Group Name",
          status: :PAUSED,
          type: :SEARCH_STANDARD,
          cpc_bid_micros: 1_000_000)

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mismatched_response, synced_response)

        mock_ad_group = mock_ad_group_resource
        allow(@mock_update_resource).to receive(:ad_group)
          .with("customers/1234567890/adGroups/999")
          .and_yield(mock_ad_group)

        mutate_response = mock_mutate_ad_group_response(ad_group_id: 999, customer_id: 1234567890)
        allow(@mock_ad_group_service).to receive(:mutate_ad_groups)
          .and_return(mutate_response)

        result = ad_group_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.updated?).to be true
        expect(result.synced?).to be true
      end
    end
  end

  describe 'AdGroup helper methods' do
    before do
      ad_group.google_ad_group_id = 999
      ad_group.save!
    end

    describe '#google_synced?' do
      it 'delegates to the syncer' do
        ad_group_response = mock_search_response_with_ad_group(customer_id: 1234567890,
          ad_group_id: 999,
          name: "Test Ad Group",
          status: :PAUSED,
          type: :SEARCH_STANDARD,
          cpc_bid_micros: 1_000_000)
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_group_response)

        expect(ad_group.google_synced?).to be true
      end
    end

    describe '#google_sync_result' do
      it 'returns the sync result' do
        ad_group_response = mock_search_response_with_ad_group(customer_id: 1234567890,
          ad_group_id: 999,
          name: "Test Ad Group",
          status: :PAUSED,
          type: :SEARCH_STANDARD,
          cpc_bid_micros: 1_000_000)
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_group_response)

        result = ad_group.google_sync_result
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end

    describe '#google_sync' do
      it 'syncs the ad_group' do
        ad_group_response = mock_search_response_with_ad_group(customer_id: 1234567890,
          ad_group_id: 999,
          name: "Test Ad Group",
          status: :PAUSED,
          type: :SEARCH_STANDARD,
          cpc_bid_micros: 1_000_000)
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_group_response)

        result = ad_group.google_sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end
  end

  describe '#delete' do
    context 'when remote ad_group does not exist' do
      before do
        ad_group.google_ad_group_id = nil
        ad_group.save!
      end

      it 'returns not_found result' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        result = ad_group_syncer.delete
        expect(result.not_found?).to be true
        expect(result.resource_type).to eq(:ad_group)
      end
    end

    context 'when remote ad_group exists' do
      before do
        ad_group.google_ad_group_id = 999
        ad_group.save!
      end

      it 'deletes the ad_group and returns deleted result' do
        ad_group_response = mock_search_response_with_ad_group(customer_id: 1234567890,
          ad_group_id: 999,
          name: "Test Ad Group",
          status: :PAUSED,
          type: :SEARCH_STANDARD,
          cpc_bid_micros: 1_000_000)
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_group_response)

        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:ad_group)
          .with("customers/1234567890/adGroups/999")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_ad_group_response(ad_group_id: 999, customer_id: 1234567890)
        allow(@mock_ad_group_service).to receive(:mutate_ad_groups)
          .and_return(mutate_response)

        result = ad_group_syncer.delete
        expect(result.deleted?).to be true
        expect(result.resource_type).to eq(:ad_group)
        expect(ad_group_syncer.local_resource.google_ad_group_id).to be_nil
      end

      it 'persists the nil google_ad_group_id to the database' do
        ad_group_response = mock_search_response_with_ad_group(customer_id: 1234567890,
          ad_group_id: 999,
          name: "Test Ad Group",
          status: :PAUSED,
          type: :SEARCH_STANDARD,
          cpc_bid_micros: 1_000_000)
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_group_response)

        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:ad_group)
          .with("customers/1234567890/adGroups/999")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_ad_group_response(ad_group_id: 999, customer_id: 1234567890)
        allow(@mock_ad_group_service).to receive(:mutate_ad_groups)
          .and_return(mutate_response)

        ad_group_syncer.delete

        fresh_ad_group = AdGroup.find(ad_group.id)
        expect(fresh_ad_group.google_ad_group_id).to be_nil
      end

      it 'returns error result when API call fails' do
        ad_group_response = mock_search_response_with_ad_group(customer_id: 1234567890,
          ad_group_id: 999,
          name: "Test Ad Group",
          status: :PAUSED,
          type: :SEARCH_STANDARD,
          cpc_bid_micros: 1_000_000)
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_group_response)

        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:ad_group)
          .with("customers/1234567890/adGroups/999")
          .and_return(mock_remove_operation)

        allow(@mock_ad_group_service).to receive(:mutate_ad_groups)
          .and_raise(mock_google_ads_error(message: "Ad group deletion failed"))

        result = ad_group_syncer.delete
        expect(result.error?).to be true
      end
    end
  end

  describe 'after_google_sync callback' do
    let(:mock_create_resource) { double("CreateResource") }

    before do
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    it 'sets google_ad_group_id from resource_name after sync' do
      created_ad_group_response = mock_search_response_with_ad_group(customer_id: 1234567890,
        ad_group_id: 777,
        name: "Test Ad Group",
        status: :PAUSED,
        type: :SEARCH_STANDARD,
        cpc_bid_micros: 1_000_000)

      allow(@mock_google_ads_service).to receive(:search)
        .and_return(mock_empty_search_response, created_ad_group_response)

      mock_ad_group = mock_ad_group_resource
      allow(mock_create_resource).to receive(:ad_group).and_yield(mock_ad_group)

      mutate_response = mock_mutate_ad_group_response(ad_group_id: 777, customer_id: 1234567890)
      allow(@mock_ad_group_service).to receive(:mutate_ad_groups)
        .and_return(mutate_response)

      ad_group.google_sync
      expect(ad_group.reload.google_ad_group_id).to eq(777)
    end

    it 'persists the google_ad_group_id to the database' do
      created_ad_group_response = mock_search_response_with_ad_group(customer_id: 1234567890,
        ad_group_id: 888,
        name: "Test Ad Group",
        status: :PAUSED,
        type: :SEARCH_STANDARD,
        cpc_bid_micros: 1_000_000)

      allow(@mock_google_ads_service).to receive(:search)
        .and_return(mock_empty_search_response, created_ad_group_response)

      mock_ad_group = mock_ad_group_resource
      allow(mock_create_resource).to receive(:ad_group).and_yield(mock_ad_group)

      mutate_response = mock_mutate_ad_group_response(ad_group_id: 888, customer_id: 1234567890)
      allow(@mock_ad_group_service).to receive(:mutate_ad_groups)
        .and_return(mutate_response)

      ad_group.google_sync

      fresh_ad_group = AdGroup.find(ad_group.id)
      expect(fresh_ad_group.google_ad_group_id).to eq(888)
    end
  end
end
