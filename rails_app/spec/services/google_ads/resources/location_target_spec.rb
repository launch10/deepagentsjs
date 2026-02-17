require 'rails_helper'

RSpec.describe GoogleAds::Resources::LocationTarget do
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
      platform_settings: { "google" => { "geo_target_constant" => "geoTargetConstants/21167" } })
  end
  let(:location_target_syncer) { described_class.new(ad_location_target) }

  before do
    mock_google_ads_client
    allow(campaign).to receive(:google_customer_id).and_return("1234567890")
    allow(campaign).to receive(:google_campaign_id).and_return(789)
  end

  describe '#record' do
    it 'returns the ad_location_target passed to the syncer' do
      expect(location_target_syncer.record).to eq(ad_location_target)
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # FIELD MAPPABLE TESTS
  # ═══════════════════════════════════════════════════════════════

  describe '.field_mappings' do
    it 'registers all expected fields' do
      expect(described_class.field_mappings.keys).to contain_exactly(:negative)
    end

    it 'has no immutable fields' do
      immutable_fields = described_class.field_mappings.select { |_, m| m[:immutable] }.keys
      expect(immutable_fields).to be_empty
    end

    it 'returns all fields as mutable' do
      expect(described_class.mutable_fields).to contain_exactly(:negative)
    end
  end

  describe '#to_google_json' do
    context 'when targeted is true' do
      before { ad_location_target.targeted = true }

      it 'returns negative as false (targeted locations are not negative)' do
        result = location_target_syncer.to_google_json
        expect(result).to eq(negative: false)
      end
    end

    context 'when targeted is false' do
      before { ad_location_target.targeted = false }

      it 'returns negative as true (excluded locations are negative)' do
        result = location_target_syncer.to_google_json
        expect(result).to eq(negative: true)
      end
    end
  end

  describe '#from_google_json' do
    it 'returns targeted-style values from remote negative field (negative: false -> true)' do
      remote = double("Remote", negative: false)
      result = location_target_syncer.from_google_json(remote)
      expect(result).to eq(negative: true)
    end

    it 'returns targeted-style values from remote negative field (negative: true -> false)' do
      remote = double("Remote", negative: true)
      result = location_target_syncer.from_google_json(remote)
      expect(result).to eq(negative: false)
    end
  end

  describe '#fetch' do
    context 'when criterion exists by ID' do
      before do
        ad_location_target.platform_settings["google"]["criterion_id"] = 111
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

        remote = location_target_syncer.fetch
        expect(remote.criterion_id).to eq(111)
        expect(remote.location.geo_target_constant).to eq("geoTargetConstants/21167")
      end
    end

    context 'when criterion_id is not set' do
      before do
        ad_location_target.platform_settings["google"].delete("criterion_id")
        ad_location_target.save!
      end

      it 'returns nil' do
        expect(location_target_syncer.fetch).to be_nil
      end
    end

    context 'when criterion does not exist remotely' do
      before do
        ad_location_target.platform_settings["google"]["criterion_id"] = 111
        ad_location_target.save!
      end

      it 'returns nil' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        expect(location_target_syncer.fetch).to be_nil
      end
    end
  end

  describe '#synced?' do
    context 'when no criterion_id' do
      before do
        ad_location_target.platform_settings["google"].delete("criterion_id")
        ad_location_target.save!
      end

      it 'returns false' do
        expect(location_target_syncer.synced?).to be false
      end
    end

    context 'when values match' do
      before do
        ad_location_target.platform_settings["google"]["criterion_id"] = 111
        ad_location_target.save!
      end

      it 'returns true' do
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
    end

    context 'when values do not match (negative mismatch)' do
      before do
        ad_location_target.platform_settings["google"]["criterion_id"] = 111
        ad_location_target.save!
      end

      it 'returns false' do
        criterion_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: true # mismatches targeted: true
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        expect(location_target_syncer.synced?).to be false
      end
    end

    context 'when local has ID but Google does not have criterion (stale ID)' do
      before do
        ad_location_target.platform_settings["google"]["criterion_id"] = 111
        ad_location_target.save!
      end

      it 'returns false' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        expect(location_target_syncer.synced?).to be false
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
        ad_location_target.platform_settings["google"]["criterion_id"] = 111
        ad_location_target.save!
      end

      it 'returns unchanged result without making API calls' do
        criterion_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        expect(@mock_campaign_criterion_service).not_to receive(:mutate_campaign_criteria)
        result = location_target_syncer.sync
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.unchanged?).to be true
      end
    end

    context 'when remote criterion does not exist' do
      before do
        ad_location_target.platform_settings["google"].delete("criterion_id")
        ad_location_target.save!
      end

      it 'creates a new criterion' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        mock_criterion = mock_campaign_criterion_resource
        mock_location_info = double("LocationInfo")
        allow(mock_location_info).to receive(:geo_target_constant=)
        allow(@mock_resource).to receive(:location_info).and_yield(mock_location_info).and_return(mock_location_info)
        allow(mock_create_resource).to receive(:campaign_criterion).and_yield(mock_criterion)

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 222, campaign_id: 789, customer_id: 1234567890)
        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_return(mutate_response)

        result = location_target_syncer.sync
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.created?).to be true
        expect(result.resource_name).to eq(222)
        expect(location_target_syncer.record.google_criterion_id).to eq("222")
      end

      it 'returns error result when API call fails' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        mock_criterion = mock_campaign_criterion_resource
        mock_location_info = double("LocationInfo")
        allow(mock_location_info).to receive(:geo_target_constant=)
        allow(@mock_resource).to receive(:location_info).and_yield(mock_location_info).and_return(mock_location_info)
        allow(mock_create_resource).to receive(:campaign_criterion).and_yield(mock_criterion)

        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_raise(mock_google_ads_error(message: "Criterion creation failed"))

        result = location_target_syncer.sync
        expect(result.error?).to be true
      end
    end

    context 'when remote criterion exists but needs update (negative changed)' do
      before do
        ad_location_target.platform_settings["google"]["criterion_id"] = 111
        ad_location_target.targeted = false # negative should be true
        ad_location_target.save!
      end

      it 'updates the criterion with the new negative value' do
        mismatched_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false # local targeted=false means negative should be true
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mismatched_response)

        mock_criterion = mock_campaign_criterion_resource
        allow(@mock_update_resource).to receive(:campaign_criterion)
          .with("customers/1234567890/campaignCriteria/789~111")
          .and_yield(mock_criterion)

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 111, campaign_id: 789, customer_id: 1234567890)
        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_return(mutate_response)

        result = location_target_syncer.sync
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.updated?).to be true
      end

      it 'returns error result when update API call fails' do
        mismatched_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mismatched_response)

        mock_criterion = mock_campaign_criterion_resource
        allow(@mock_update_resource).to receive(:campaign_criterion)
          .with("customers/1234567890/campaignCriteria/789~111")
          .and_yield(mock_criterion)

        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_raise(mock_google_ads_error(message: "Criterion update failed"))

        result = location_target_syncer.sync
        expect(result.error?).to be true
      end
    end
  end

  describe '#sync_plan' do
    context 'when already synced' do
      before do
        ad_location_target.platform_settings["google"]["criterion_id"] = 111
        ad_location_target.save!
      end

      it 'returns unchanged operation' do
        criterion_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        plan = location_target_syncer.sync_plan
        expect(plan.operations.size).to eq(1)
        expect(plan.operations.first[:action]).to eq(:unchanged)
        expect(plan.operations.first[:record]).to eq(ad_location_target)
      end
    end

    context 'when remote does not exist' do
      before do
        ad_location_target.platform_settings["google"].delete("criterion_id")
        ad_location_target.save!
      end

      it 'returns create operation' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        plan = location_target_syncer.sync_plan
        expect(plan.operations.length).to eq(1)
        expect(plan.operations.first[:action]).to eq(:create)
        expect(plan.operations.first[:geo_target_constant]).to eq("geoTargetConstants/21167")
        expect(plan.operations.first[:negative]).to eq(false)
      end
    end

    context 'when remote exists but negative mismatches' do
      before do
        ad_location_target.platform_settings["google"]["criterion_id"] = 111
        ad_location_target.targeted = false # negative should be true
        ad_location_target.save!
      end

      it 'returns update operation' do
        mismatched_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false # should be true
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mismatched_response)

        plan = location_target_syncer.sync_plan
        expect(plan.operations.length).to eq(1)
        expect(plan.operations.first[:action]).to eq(:update)
        expect(plan.operations.first[:fields]).to include(:negative)
      end
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # SYNC RESULT (instance + class + campaign wrapper)
  # ═══════════════════════════════════════════════════════════════

  describe "#sync_result" do
    context "when no google_criterion_id" do
      before do
        ad_location_target.platform_settings["google"].delete("criterion_id")
        ad_location_target.save!
      end

      it "returns not_found" do
        result = location_target_syncer.sync_result
        expect(result.not_found?).to be true
      end
    end

    context "when google_criterion_id exists but remote not found" do
      before do
        ad_location_target.platform_settings["google"]["criterion_id"] = 111
        ad_location_target.save!
      end

      it "returns not_found" do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
        result = location_target_syncer.sync_result
        expect(result.not_found?).to be true
      end
    end

    context "when remote matches" do
      before do
        ad_location_target.platform_settings["google"]["criterion_id"] = 111
        ad_location_target.save!
      end

      it "returns unchanged" do
        criterion_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        result = location_target_syncer.sync_result
        expect(result.unchanged?).to be true
        expect(result.resource_name).to eq(111)
      end
    end

    context "when remote does not match" do
      before do
        ad_location_target.platform_settings["google"]["criterion_id"] = 111
        ad_location_target.targeted = false
        ad_location_target.save!
      end

      it "returns error with SyncVerificationError" do
        criterion_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false # local targeted=false means negative=true, so this mismatches
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        result = location_target_syncer.sync_result
        expect(result.error?).to be true
        expect(result.error).to be_a(GoogleAds::SyncVerificationError)
        expect(result.error.message).to include("Location target sync verification failed")
      end
    end
  end

  describe ".sync_result" do
    it "returns a CollectionSyncResult" do
      ad_location_target.platform_settings["google"]["criterion_id"] = 111
      ad_location_target.save!

      criterion_response = mock_search_response_with_campaign_criterion(
        criterion_id: 111,
        campaign_id: 789,
        customer_id: 1234567890,
        location_id: 21167,
        negative: false
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

      result = described_class.sync_result(campaign)
      expect(result).to be_a(GoogleAds::Sync::CollectionSyncResult)
    end
  end

  describe "Campaign#location_targets_sync_result" do
    it "delegates to the resource class" do
      ad_location_target.platform_settings["google"]["criterion_id"] = 111
      ad_location_target.save!

      criterion_response = mock_search_response_with_campaign_criterion(
        criterion_id: 111,
        campaign_id: 789,
        customer_id: 1234567890,
        location_id: 21167,
        negative: false
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

      result = campaign.location_targets_sync_result
      expect(result).to be_a(GoogleAds::Sync::CollectionSyncResult)
    end
  end

  describe '#delete' do
    let(:mock_remove_resource) { double("RemoveResource") }

    before do
      allow(@mock_operation).to receive(:remove_resource).and_return(mock_remove_resource)
    end

    context 'when no criterion_id' do
      before do
        ad_location_target.platform_settings["google"].delete("criterion_id")
        ad_location_target.save!
      end

      it 'returns not_found result' do
        result = location_target_syncer.delete
        expect(result.not_found?).to be true
        expect(result.resource_type).to eq(:campaign_criterion)
      end
    end

    context 'when criterion_id exists' do
      before do
        ad_location_target.platform_settings["google"]["criterion_id"] = 111
        ad_location_target.save!
      end

      it 'deletes the criterion and returns deleted result' do
        mock_remove_operation = double("RemoveOperation")
        allow(mock_remove_resource).to receive(:campaign_criterion)
          .with("customers/1234567890/campaignCriteria/789~111")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 111, campaign_id: 789, customer_id: 1234567890)
        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_return(mutate_response)

        result = location_target_syncer.delete
        expect(result.deleted?).to be true
        expect(result.resource_type).to eq(:campaign_criterion)
        expect(location_target_syncer.record.google_criterion_id).to be_nil
      end

      it 'persists the nil google_criterion_id to the database' do
        mock_remove_operation = double("RemoveOperation")
        allow(mock_remove_resource).to receive(:campaign_criterion)
          .with("customers/1234567890/campaignCriteria/789~111")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 111, campaign_id: 789, customer_id: 1234567890)
        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_return(mutate_response)

        location_target_syncer.delete

        fresh_target = AdLocationTarget.find(ad_location_target.id)
        expect(fresh_target.google_criterion_id).to be_nil
      end

      it 'returns error result when API call fails' do
        mock_remove_operation = double("RemoveOperation")
        allow(mock_remove_resource).to receive(:campaign_criterion)
          .with("customers/1234567890/campaignCriteria/789~111")
          .and_return(mock_remove_operation)

        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_raise(mock_google_ads_error(message: "Criterion deletion failed"))

        result = location_target_syncer.delete
        expect(result.error?).to be true
      end

      it 'clears local ID and returns deleted when Google returns not found (stale ID)' do
        mock_remove_operation = double("RemoveOperation")
        allow(mock_remove_resource).to receive(:campaign_criterion)
          .with("customers/1234567890/campaignCriteria/789~111")
          .and_return(mock_remove_operation)

        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_raise(mock_google_ads_error(
            message: "Resource not found",
            error_type: :mutate_error,
            error_value: :RESOURCE_NOT_FOUND
          ))

        result = location_target_syncer.delete
        expect(result.deleted?).to be true
        expect(location_target_syncer.record.reload.google_criterion_id).to be_nil
      end
    end
  end

  describe '#compare_fields' do
    before do
      ad_location_target.platform_settings["google"]["criterion_id"] = 111
      ad_location_target.save!
    end

    it 'returns match when negative matches !targeted' do
      criterion_response = mock_search_response_with_campaign_criterion(
        criterion_id: 111,
        campaign_id: 789,
        customer_id: 1234567890,
        location_id: 21167,
        negative: false # matches targeted: true
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

      remote = location_target_syncer.fetch
      comparison = location_target_syncer.compare_fields(remote)
      expect(comparison.match?).to be true
      expect(comparison.failures).to be_empty
    end

    it 'detects negative mismatch' do
      criterion_response = mock_search_response_with_campaign_criterion(
        criterion_id: 111,
        campaign_id: 789,
        customer_id: 1234567890,
        location_id: 21167,
        negative: true # mismatches targeted: true
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

      remote = location_target_syncer.fetch
      comparison = location_target_syncer.compare_fields(remote)
      expect(comparison.match?).to be false
      expect(comparison.failures).to include(:negative)
    end
  end

  describe 'AdLocationTarget model helper methods' do
    before do
      ad_location_target.platform_settings["google"]["criterion_id"] = 111
      ad_location_target.save!
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

    describe '#google_sync' do
      it 'returns unchanged when already synced' do
        criterion_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        result = ad_location_target.google_sync
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.unchanged?).to be true
      end
    end
  end

  describe 'save_criterion_id after create' do
    let(:mock_create_resource) { double("CreateResource") }

    before do
      ad_location_target.platform_settings["google"].delete("criterion_id")
      ad_location_target.save!
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    it 'sets google_criterion_id from response after sync' do
      allow(@mock_google_ads_service).to receive(:search)
        .and_return(mock_empty_search_response)

      mock_criterion = mock_campaign_criterion_resource
      mock_location_info = double("LocationInfo")
      allow(mock_location_info).to receive(:geo_target_constant=)
      allow(@mock_resource).to receive(:location_info).and_yield(mock_location_info).and_return(mock_location_info)
      allow(mock_create_resource).to receive(:campaign_criterion).and_yield(mock_criterion)

      mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 444, campaign_id: 789, customer_id: 1234567890)
      allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
        .and_return(mutate_response)

      location_target_syncer.sync
      expect(ad_location_target.reload.google_criterion_id).to eq("444")
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # CLASS METHOD TESTS
  # ═══════════════════════════════════════════════════════════════

  describe '.synced?' do
    context 'when all targets are synced' do
      before do
        ad_location_target.platform_settings["google"]["criterion_id"] = 111
        ad_location_target.save!
      end

      it 'returns true' do
        criterion_response = mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 1234567890,
          location_id: 21167,
          negative: false
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        expect(described_class.synced?(campaign)).to be true
      end
    end

    context 'when any target is not synced' do
      before do
        ad_location_target.platform_settings["google"].delete("criterion_id")
        ad_location_target.save!
      end

      it 'returns false' do
        expect(described_class.synced?(campaign)).to be false
      end
    end

    context 'when soft-deleted targets have Google IDs' do
      before do
        ad_location_target.platform_settings["google"]["criterion_id"] = 111
        ad_location_target.save!
        ad_location_target.destroy # soft-delete
      end

      it 'returns false (needs cleanup)' do
        expect(described_class.synced?(campaign)).to be false
      end
    end
  end

  describe '.sync_all' do
    let(:mock_create_resource) { double("CreateResource") }
    let(:mock_remove_resource) { double("RemoveResource") }

    before do
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
      allow(@mock_operation).to receive(:remove_resource).and_return(mock_remove_resource)
    end

    context 'when syncing active targets' do
      before do
        ad_location_target.platform_settings["google"].delete("criterion_id")
        ad_location_target.save!
      end

      it 'syncs each active target' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        mock_criterion = mock_campaign_criterion_resource
        mock_location_info = double("LocationInfo")
        allow(mock_location_info).to receive(:geo_target_constant=)
        allow(@mock_resource).to receive(:location_info).and_yield(mock_location_info).and_return(mock_location_info)
        allow(mock_create_resource).to receive(:campaign_criterion).and_yield(mock_criterion)

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 222, campaign_id: 789, customer_id: 1234567890)
        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_return(mutate_response)

        result = described_class.sync_all(campaign)
        expect(result).to be_a(GoogleAds::Sync::CollectionSyncResult)
        expect(result.results.first.created?).to be true
      end
    end

    context 'when deleting soft-deleted targets with Google IDs' do
      before do
        ad_location_target.platform_settings["google"]["criterion_id"] = 111
        ad_location_target.save!
        ad_location_target.destroy # soft-delete
      end

      it 'deletes each soft-deleted target with Google ID' do
        mock_remove_operation = double("RemoveOperation")
        allow(mock_remove_resource).to receive(:campaign_criterion)
          .with("customers/1234567890/campaignCriteria/789~111")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_campaign_criterion_response(criterion_id: 111, campaign_id: 789, customer_id: 1234567890)
        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
          .and_return(mutate_response)

        result = described_class.sync_all(campaign)
        expect(result).to be_a(GoogleAds::Sync::CollectionSyncResult)
        expect(result.results.first.deleted?).to be true
      end
    end
  end

  describe '.sync_plan' do
    context 'when targets need sync' do
      before do
        ad_location_target.platform_settings["google"].delete("criterion_id")
        ad_location_target.save!
      end

      it 'returns plan with create operations' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        plan = described_class.sync_plan(campaign)
        expect(plan).to be_a(GoogleAds::Sync::Plan)
        expect(plan.operations.first[:action]).to eq(:create)
      end
    end

    context 'when soft-deleted targets have Google IDs' do
      before do
        ad_location_target.platform_settings["google"]["criterion_id"] = 111
        ad_location_target.save!
        ad_location_target.destroy # soft-delete
      end

      it 'returns plan with delete operations' do
        plan = described_class.sync_plan(campaign)
        expect(plan).to be_a(GoogleAds::Sync::Plan)
        expect(plan.operations.first[:action]).to eq(:delete)
        expect(plan.operations.first[:criterion_id]).to eq(111)
      end
    end
  end
end
