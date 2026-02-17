require 'rails_helper'

RSpec.describe GoogleAds::Resources::AdGroup do
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
    allow(campaign).to receive(:google_customer_id).and_return("1234567890")
    allow(campaign).to receive(:google_campaign_id).and_return(789)
  end

  # ═══════════════════════════════════════════════════════════════
  # INSTRUMENTATION
  # ═══════════════════════════════════════════════════════════════

  describe 'instrumentation' do
    it 'includes Instrumentable' do
      expect(described_class.ancestors.map(&:name)).to include('GoogleAds::Resources::Instrumentable')
    end

    it 'provides instrumentation context with ad_group' do
      expect(ad_group_syncer.instrumentation_context).to eq({ ad_group: ad_group })
    end

    it 'tags logs with ad_group_id and campaign_id' do
      ad_group.google_ad_group_id = 456
      ad_group.google_status = "PAUSED"
      ad_group.google_type = "SEARCH_STANDARD"
      ad_group.google_cpc_bid_micros = 1_000_000
      ad_group.save!

      ad_group_response = mock_search_response_with_ad_group(
        ad_group_id: 456,
        name: ad_group.name,
        status: :PAUSED,
        type: :SEARCH_STANDARD,
        cpc_bid_micros: 1_000_000
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(ad_group_response)

      # Instrumentation formats tags as "key=value" strings for log aggregator compatibility
      expect(GoogleAds::Instrumentation.google_ads_logger).to receive(:tagged).with(
        "ad_group_id=#{ad_group.id}",
        "campaign_id=#{campaign.id}"
      ).at_least(:once).and_yield

      ad_group_syncer.fetch
    end

    describe 'instrumented methods' do
      %i[sync sync_result sync_plan delete fetch].each do |method|
        it "wraps #{method} with instrumentation" do
          expect(GoogleAds::Instrumentation).to receive(:with_context)
            .with(ad_group: ad_group)
            .at_least(:once)
            .and_call_original

          # Setup ad_group with Google ID
          ad_group.google_ad_group_id = 456
          ad_group.google_status = "PAUSED"
          ad_group.google_type = "SEARCH_STANDARD"
          ad_group.google_cpc_bid_micros = 1_000_000
          ad_group.save!

          # Mock the API response
          ad_group_response = mock_search_response_with_ad_group(
            ad_group_id: 456,
            name: ad_group.name,
            status: :PAUSED,
            type: :SEARCH_STANDARD,
            cpc_bid_micros: 1_000_000
          )
          allow(@mock_google_ads_service).to receive(:search).and_return(ad_group_response)

          # Mock delete operation for the delete test
          if method == :delete
            mock_ad_group_service = double("AdGroupService")
            allow(@mock_client).to receive(:service).and_return(
              double("Services",
                customer: @mock_customer_service,
                google_ads: @mock_google_ads_service,
                ad_group: mock_ad_group_service)
            )
            allow(@mock_remove_resource).to receive(:ad_group).and_return(double("RemoveOperation"))
            allow(mock_ad_group_service).to receive(:mutate_ad_groups).and_return(double("Response"))
          end

          ad_group_syncer.public_send(method)
        end
      end
    end
  end

  describe '#record' do
    it 'returns the ad_group passed to the syncer' do
      expect(ad_group_syncer.record).to eq(ad_group)
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # FieldMappable DSL
  # ═══════════════════════════════════════════════════════════════

  describe '.field_mappings' do
    it 'registers all expected fields' do
      expect(described_class.field_mappings.keys).to contain_exactly(
        :name, :status, :type, :cpc_bid_micros
      )
    end

    it 'marks type as immutable' do
      expect(described_class.immutable_fields).to eq([:type])
    end

    it 'returns mutable fields' do
      expect(described_class.mutable_fields).to eq([:name, :status, :cpc_bid_micros])
    end
  end

  describe '#to_google_json' do
    before do
      ad_group.google_status = "PAUSED"
      ad_group.google_type = "SEARCH_STANDARD"
      ad_group.google_cpc_bid_micros = 1_000_000
      ad_group.save!
    end

    it 'returns hash of local field values in Google format' do
      result = ad_group_syncer.to_google_json

      expect(result).to eq(
        name: "Test Ad Group",
        status: :PAUSED,
        type: :SEARCH_STANDARD,
        cpc_bid_micros: 1_000_000
      )
    end
  end

  describe '#from_google_json' do
    let(:remote) do
      double("RemoteAdGroup",
        name: "Remote Ad Group",
        status: :ENABLED,
        type: :DISPLAY_STANDARD,
        cpc_bid_micros: 2_000_000)
    end

    it 'returns hash of remote field values in local format' do
      result = ad_group_syncer.from_google_json(remote)

      expect(result).to eq(
        name: "Remote Ad Group",
        status: "ENABLED",
        type: "DISPLAY_STANDARD",
        cpc_bid_micros: 2_000_000
      )
    end
  end

  describe '#compare_fields' do
    before do
      ad_group.google_status = "PAUSED"
      ad_group.google_type = "SEARCH_STANDARD"
      ad_group.google_cpc_bid_micros = 1_000_000
      ad_group.save!
    end

    let(:remote) do
      double("RemoteAdGroup",
        name: "Test Ad Group",
        status: :PAUSED,
        type: :SEARCH_STANDARD,
        cpc_bid_micros: 1_000_000)
    end

    it 'returns FieldCompare instance' do
      result = ad_group_syncer.compare_fields(remote)
      expect(result).to be_a(GoogleAds::FieldCompare)
    end

    it 'matches when all fields are equal' do
      result = ad_group_syncer.compare_fields(remote)
      expect(result.match?).to be true
    end

    it 'detects name mismatch' do
      mismatched_remote = double("RemoteAdGroup",
        name: "Different Name",
        status: :PAUSED,
        type: :SEARCH_STANDARD,
        cpc_bid_micros: 1_000_000)

      result = ad_group_syncer.compare_fields(mismatched_remote)
      expect(result.match?).to be false
      expect(result.failures).to include(:name)
    end

    it 'detects status mismatch' do
      mismatched_remote = double("RemoteAdGroup",
        name: "Test Ad Group",
        status: :ENABLED,
        type: :SEARCH_STANDARD,
        cpc_bid_micros: 1_000_000)

      result = ad_group_syncer.compare_fields(mismatched_remote)
      expect(result.match?).to be false
      expect(result.failures).to include(:status)
    end
  end

  describe '#fetch' do
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

        remote = ad_group_syncer.fetch
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

        remote = ad_group_syncer.fetch
        expect(remote.id).to eq(888)
        expect(ad_group.google_ad_group_id).to eq(888)
      end
    end

    context 'when ad_group does not exist remotely' do
      it 'returns nil' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        expect(ad_group_syncer.fetch).to be_nil
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

  describe '#sync_result' do
    context 'when remote ad_group does not exist' do
      it 'returns not_found result with success? false' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        result = ad_group_syncer.sync_result
        expect(result.not_found?).to be true
        expect(result.success?).to be false
        expect(result.resource_type).to eq(:ad_group)
      end
    end

    context 'when remote ad_group has REMOVED status' do
      before do
        ad_group.google_ad_group_id = 999
        ad_group.save!
      end

      it 'returns not_found result with success? false' do
        ad_group_response = mock_search_response_with_ad_group(customer_id: 1234567890,
          ad_group_id: 999,
          name: "Test Ad Group",
          status: :REMOVED,
          type: :SEARCH_STANDARD,
          cpc_bid_micros: 1_000_000)
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_group_response)

        result = ad_group_syncer.sync_result
        expect(result.not_found?).to be true
        expect(result.success?).to be false
      end
    end

    context 'when fields match' do
      before do
        ad_group.google_ad_group_id = 999
        ad_group.save!
      end

      it 'returns unchanged result with success? true' do
        ad_group_response = mock_search_response_with_ad_group(customer_id: 1234567890,
          ad_group_id: 999,
          name: "Test Ad Group",
          status: :PAUSED,
          type: :SEARCH_STANDARD,
          cpc_bid_micros: 1_000_000)
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_group_response)

        result = ad_group_syncer.sync_result
        expect(result.unchanged?).to be true
        expect(result.success?).to be true
        expect(result.resource_name).to eq(999)
      end
    end

    context 'when fields do not match' do
      before do
        ad_group.google_ad_group_id = 999
        ad_group.save!
      end

      it 'returns error result with SyncVerificationError' do
        ad_group_response = mock_search_response_with_ad_group(customer_id: 1234567890,
          ad_group_id: 999,
          name: "Different Name",
          status: :PAUSED,
          type: :SEARCH_STANDARD,
          cpc_bid_micros: 1_000_000)
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_group_response)

        result = ad_group_syncer.sync_result
        expect(result.error?).to be true
        expect(result.success?).to be false
        expect(result.error).to be_a(GoogleAds::SyncVerificationError)
        expect(result.error.message).to include("name")
      end
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
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.unchanged?).to be true
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
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.created?).to be true
        expect(result.resource_name).to eq(1001)
        expect(ad_group_syncer.record.google_ad_group_id).to eq(1001)
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
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.updated?).to be true
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
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.unchanged?).to be true
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
        expect(ad_group_syncer.record.google_ad_group_id).to be_nil
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
