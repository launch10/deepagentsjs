require 'rails_helper'

RSpec.describe GoogleAds::Keyword do
  include GoogleAdsMocks

  let(:account) { create(:account) }
  let(:campaign) { create(:campaign, account: account) }
  let(:ad_group) { create(:ad_group, campaign: campaign) }
  let(:ad_keyword) do
    create(:ad_keyword,
      ad_group: ad_group,
      text: "test keyword",
      match_type: "broad",
      platform_settings: { "google" => {} })
  end
  let(:keyword_syncer) { described_class.new(ad_keyword) }

  before do
    mock_google_ads_client
    allow(campaign).to receive(:google_customer_id).and_return("1234567890")
    allow(ad_group).to receive(:google_ad_group_id).and_return(999)
  end

  describe '#local_resource' do
    it 'returns the ad_keyword passed to the syncer' do
      expect(keyword_syncer.local_resource).to eq(ad_keyword)
    end
  end

  describe '#ad_group' do
    it 'returns the ad_group from the ad_keyword' do
      expect(keyword_syncer.ad_group).to eq(ad_group)
    end
  end

  describe '#fetch_remote' do
    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          ad_group_criterion: @mock_ad_group_criterion_service)
      )
    end

    context 'when criterion exists by ID' do
      before do
        ad_keyword.platform_settings["google"]["criterion_id"] = 333
        ad_keyword.save!
      end

      it 'fetches the remote criterion by ID' do
        criterion_response = mock_search_response_with_keyword(
          criterion_id: 333,
          ad_group_id: 999,
          customer_id: 1234567890,
          keyword_text: "test keyword",
          match_type: :BROAD,
          status: :ENABLED
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        remote = keyword_syncer.fetch_remote
        expect(remote.criterion_id).to eq(333)
        expect(remote.keyword.text).to eq("test keyword")
        expect(remote.keyword.match_type).to eq(:BROAD)
      end
    end

    context 'when criterion does not exist remotely' do
      it 'returns nil' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        expect(keyword_syncer.fetch_remote).to be_nil
      end
    end
  end

  describe '#sync_result' do
    before do
      ad_keyword.platform_settings["google"]["criterion_id"] = 333
      ad_keyword.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          ad_group_criterion: @mock_ad_group_criterion_service)
      )
    end

    context 'when remote criterion exists and matches local' do
      it 'returns synced result' do
        criterion_response = mock_search_response_with_keyword(
          criterion_id: 333,
          ad_group_id: 999,
          customer_id: 1234567890,
          keyword_text: "test keyword",
          match_type: :BROAD,
          status: :ENABLED
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        result = keyword_syncer.sync_result
        expect(result.synced?).to be true
        expect(result.action).to eq(:unchanged)
        expect(result.resource_type).to eq(:ad_group_criterion)
      end
    end

    context 'when remote criterion exists but does not match local (match_type mismatch)' do
      before do
        ad_keyword.match_type = "exact"
        ad_keyword.save!
      end

      it 'returns unsynced result with mismatched fields' do
        criterion_response = mock_search_response_with_keyword(
          criterion_id: 333,
          ad_group_id: 999,
          customer_id: 1234567890,
          keyword_text: "test keyword",
          match_type: :BROAD,
          status: :ENABLED
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        result = keyword_syncer.sync_result
        expect(result.synced?).to be false
        expect(result.values_match?).to be false
        expect(result.mismatched_fields.map(&:our_field)).to include(:match_type)
      end
    end

    context 'when remote criterion does not exist' do
      before do
        ad_keyword.platform_settings["google"].delete("criterion_id")
        ad_keyword.save!
      end

      it 'returns not_found result' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        result = keyword_syncer.sync_result
        expect(result.not_found?).to be true
        expect(result.synced?).to be false
      end
    end
  end

  describe '#synced?' do
    before do
      ad_keyword.platform_settings["google"]["criterion_id"] = 333
      ad_keyword.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          ad_group_criterion: @mock_ad_group_criterion_service)
      )
    end

    it 'returns true when values match' do
      criterion_response = mock_search_response_with_keyword(
        criterion_id: 333,
        ad_group_id: 999,
        customer_id: 1234567890,
        keyword_text: "test keyword",
        match_type: :BROAD,
        status: :ENABLED
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

      expect(keyword_syncer.synced?).to be true
    end

    it 'returns false when values do not match' do
      criterion_response = mock_search_response_with_keyword(
        criterion_id: 333,
        ad_group_id: 999,
        customer_id: 1234567890,
        keyword_text: "test keyword",
        match_type: :EXACT,
        status: :ENABLED
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

      expect(keyword_syncer.synced?).to be false
    end
  end

  describe '#sync' do
    let(:mock_create_resource) { double("CreateResource") }

    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          ad_group_criterion: @mock_ad_group_criterion_service)
      )
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    context 'when already synced' do
      before do
        ad_keyword.platform_settings["google"]["criterion_id"] = 333
        ad_keyword.save!
      end

      it 'returns sync_result without making API calls' do
        criterion_response = mock_search_response_with_keyword(
          criterion_id: 333,
          ad_group_id: 999,
          customer_id: 1234567890,
          keyword_text: "test keyword",
          match_type: :BROAD,
          status: :ENABLED
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        expect(@mock_ad_group_criterion_service).not_to receive(:mutate_ad_group_criteria)
        result = keyword_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end

    context 'when remote criterion does not exist' do
      before do
        ad_keyword.platform_settings["google"].delete("criterion_id")
        ad_keyword.save!
      end

      it 'creates a new criterion and verifies sync' do
        created_criterion_response = mock_search_response_with_keyword(
          criterion_id: 444,
          ad_group_id: 999,
          customer_id: 1234567890,
          keyword_text: "test keyword",
          match_type: :BROAD,
          status: :ENABLED
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response, created_criterion_response)

        mock_criterion = mock_ad_group_criterion_resource
        mock_keyword_info = mock_keyword_info_resource
        allow(@mock_resource).to receive(:keyword_info).and_yield(mock_keyword_info).and_return(mock_keyword_info)
        allow(mock_create_resource).to receive(:ad_group_criterion).and_yield(mock_criterion)

        mutate_response = mock_mutate_ad_group_criterion_response(criterion_id: 444, ad_group_id: 999, customer_id: 1234567890)
        allow(@mock_ad_group_criterion_service).to receive(:mutate_ad_group_criteria)
          .and_return(mutate_response)

        result = keyword_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.created?).to be true
        expect(result.resource_name).to eq("customers/1234567890/adGroupCriteria/999~444")
        expect(result.synced?).to be true
        expect(keyword_syncer.local_resource.google_criterion_id).to eq(444)
      end

      it 'returns error result when API call fails' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        mock_criterion = mock_ad_group_criterion_resource
        mock_keyword_info = mock_keyword_info_resource
        allow(@mock_resource).to receive(:keyword_info).and_yield(mock_keyword_info).and_return(mock_keyword_info)
        allow(mock_create_resource).to receive(:ad_group_criterion).and_yield(mock_criterion)

        allow(@mock_ad_group_criterion_service).to receive(:mutate_ad_group_criteria)
          .and_raise(mock_google_ads_error(message: "Criterion creation failed"))

        result = keyword_syncer.sync
        expect(result.error?).to be true
      end
    end

    context 'when remote criterion exists but needs update (match_type changed)' do
      let(:mock_update_resource) { double("UpdateResource") }

      before do
        ad_keyword.platform_settings["google"]["criterion_id"] = 333
        ad_keyword.match_type = "exact"  # Local is EXACT
        ad_keyword.save!
        allow(@mock_operation).to receive(:update_resource).and_return(mock_update_resource)
      end

      it 'updates the criterion with the new match_type' do
        # Remote has BROAD, local has EXACT - should trigger update
        remote_broad_response = mock_search_response_with_keyword(
          criterion_id: 333,
          ad_group_id: 999,
          customer_id: 1234567890,
          keyword_text: "test keyword",
          match_type: :BROAD,
          status: :ENABLED
        )

        # After update, remote should have EXACT
        updated_response = mock_search_response_with_keyword(
          criterion_id: 333,
          ad_group_id: 999,
          customer_id: 1234567890,
          keyword_text: "test keyword",
          match_type: :EXACT,
          status: :ENABLED
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(remote_broad_response, updated_response)

        mock_criterion = mock_ad_group_criterion_resource
        mock_keyword_info = mock_keyword_info_resource
        allow(@mock_resource).to receive(:keyword_info).and_yield(mock_keyword_info).and_return(mock_keyword_info)
        allow(mock_update_resource).to receive(:ad_group_criterion)
          .with("customers/1234567890/adGroupCriteria/999~333")
          .and_yield(mock_criterion)

        mutate_response = mock_mutate_ad_group_criterion_response(
          criterion_id: 333,
          ad_group_id: 999,
          customer_id: 1234567890
        )
        allow(@mock_ad_group_criterion_service).to receive(:mutate_ad_group_criteria)
          .and_return(mutate_response)

        result = keyword_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.updated?).to be true
        expect(result.synced?).to be true
        expect(result.resource_name).to eq("customers/1234567890/adGroupCriteria/999~333")
      end

      it 'returns error result when update API call fails' do
        remote_broad_response = mock_search_response_with_keyword(
          criterion_id: 333,
          ad_group_id: 999,
          customer_id: 1234567890,
          keyword_text: "test keyword",
          match_type: :BROAD,
          status: :ENABLED
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(remote_broad_response)

        mock_criterion = mock_ad_group_criterion_resource
        mock_keyword_info = mock_keyword_info_resource
        allow(@mock_resource).to receive(:keyword_info).and_yield(mock_keyword_info).and_return(mock_keyword_info)
        allow(mock_update_resource).to receive(:ad_group_criterion)
          .with("customers/1234567890/adGroupCriteria/999~333")
          .and_yield(mock_criterion)

        allow(@mock_ad_group_criterion_service).to receive(:mutate_ad_group_criteria)
          .and_raise(mock_google_ads_error(message: "Criterion update failed"))

        result = keyword_syncer.sync
        expect(result.error?).to be true
      end
    end
  end

  describe '#delete' do
    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          ad_group_criterion: @mock_ad_group_criterion_service)
      )
    end

    context 'when remote criterion does not exist' do
      before do
        ad_keyword.platform_settings["google"].delete("criterion_id")
        ad_keyword.save!
      end

      it 'returns not_found result' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        result = keyword_syncer.delete
        expect(result.not_found?).to be true
        expect(result.resource_type).to eq(:ad_group_criterion)
      end
    end

    context 'when remote criterion exists' do
      before do
        ad_keyword.platform_settings["google"]["criterion_id"] = 333
        ad_keyword.save!
      end

      it 'deletes the criterion and returns deleted result' do
        criterion_response = mock_search_response_with_keyword(
          criterion_id: 333,
          ad_group_id: 999,
          customer_id: 1234567890,
          keyword_text: "test keyword",
          match_type: :BROAD,
          status: :ENABLED
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:ad_group_criterion)
          .with("customers/1234567890/adGroupCriteria/999~333")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_ad_group_criterion_response(criterion_id: 333, ad_group_id: 999, customer_id: 1234567890)
        allow(@mock_ad_group_criterion_service).to receive(:mutate_ad_group_criteria)
          .and_return(mutate_response)

        result = keyword_syncer.delete
        expect(result.deleted?).to be true
        expect(result.resource_type).to eq(:ad_group_criterion)
        expect(keyword_syncer.local_resource.google_criterion_id).to be_nil
      end

      it 'persists the nil google_criterion_id to the database' do
        criterion_response = mock_search_response_with_keyword(
          criterion_id: 333,
          ad_group_id: 999,
          customer_id: 1234567890,
          keyword_text: "test keyword",
          match_type: :BROAD,
          status: :ENABLED
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:ad_group_criterion)
          .with("customers/1234567890/adGroupCriteria/999~333")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_ad_group_criterion_response(criterion_id: 333, ad_group_id: 999, customer_id: 1234567890)
        allow(@mock_ad_group_criterion_service).to receive(:mutate_ad_group_criteria)
          .and_return(mutate_response)

        keyword_syncer.delete

        fresh_keyword = AdKeyword.find(ad_keyword.id)
        expect(fresh_keyword.google_criterion_id).to be_nil
      end

      it 'returns error result when API call fails' do
        criterion_response = mock_search_response_with_keyword(
          criterion_id: 333,
          ad_group_id: 999,
          customer_id: 1234567890,
          keyword_text: "test keyword",
          match_type: :BROAD,
          status: :ENABLED
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:ad_group_criterion)
          .with("customers/1234567890/adGroupCriteria/999~333")
          .and_return(mock_remove_operation)

        allow(@mock_ad_group_criterion_service).to receive(:mutate_ad_group_criteria)
          .and_raise(mock_google_ads_error(message: "Criterion deletion failed"))

        result = keyword_syncer.delete
        expect(result.error?).to be true
      end
    end
  end

  describe 'AdKeyword helper methods' do
    before do
      ad_keyword.platform_settings["google"]["criterion_id"] = 333
      ad_keyword.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          ad_group_criterion: @mock_ad_group_criterion_service)
      )
    end

    describe '#google_synced?' do
      it 'delegates to the syncer' do
        criterion_response = mock_search_response_with_keyword(
          criterion_id: 333,
          ad_group_id: 999,
          customer_id: 1234567890,
          keyword_text: "test keyword",
          match_type: :BROAD,
          status: :ENABLED
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        expect(ad_keyword.google_synced?).to be true
      end
    end

    describe '#google_sync_result' do
      it 'returns the sync result' do
        criterion_response = mock_search_response_with_keyword(
          criterion_id: 333,
          ad_group_id: 999,
          customer_id: 1234567890,
          keyword_text: "test keyword",
          match_type: :BROAD,
          status: :ENABLED
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        result = ad_keyword.google_sync_result
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end

    describe '#google_sync' do
      it 'syncs the keyword' do
        criterion_response = mock_search_response_with_keyword(
          criterion_id: 333,
          ad_group_id: 999,
          customer_id: 1234567890,
          keyword_text: "test keyword",
          match_type: :BROAD,
          status: :ENABLED
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        result = ad_keyword.google_sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end
  end

  describe 'after_google_sync callback' do
    let(:mock_create_resource) { double("CreateResource") }

    before do
      ad_keyword.platform_settings["google"].delete("criterion_id")
      ad_keyword.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          ad_group_criterion: @mock_ad_group_criterion_service)
      )
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    it 'sets google_criterion_id from resource_name after sync' do
      created_criterion_response = mock_search_response_with_keyword(
        criterion_id: 555,
        ad_group_id: 999,
        customer_id: 1234567890,
        keyword_text: "test keyword",
        match_type: :BROAD,
        status: :ENABLED
      )

      allow(@mock_google_ads_service).to receive(:search)
        .and_return(mock_empty_search_response, created_criterion_response)

      mock_criterion = mock_ad_group_criterion_resource
      mock_keyword_info = mock_keyword_info_resource
      allow(@mock_resource).to receive(:keyword_info).and_yield(mock_keyword_info).and_return(mock_keyword_info)
      allow(mock_create_resource).to receive(:ad_group_criterion).and_yield(mock_criterion)

      mutate_response = mock_mutate_ad_group_criterion_response(criterion_id: 555, ad_group_id: 999, customer_id: 1234567890)
      allow(@mock_ad_group_criterion_service).to receive(:mutate_ad_group_criteria)
        .and_return(mutate_response)

      ad_keyword.google_sync
      expect(ad_keyword.reload.google_criterion_id).to eq("555")
    end
  end
end
