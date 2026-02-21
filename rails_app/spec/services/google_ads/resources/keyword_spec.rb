require 'rails_helper'

RSpec.describe GoogleAds::Resources::Keyword do
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

  describe '#record' do
    it 'returns the ad_keyword passed to the syncer' do
      expect(keyword_syncer.record).to eq(ad_keyword)
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # #to_google_json (FieldMappable)
  # ═══════════════════════════════════════════════════════════════

  describe '#to_google_json' do
    it 'keeps text as-is' do
      ad_keyword.text = "test keyword"
      result = keyword_syncer.to_google_json
      expect(result[:text]).to eq("test keyword")
    end

    it 'transforms match_type "broad" to :BROAD' do
      ad_keyword.match_type = "broad"
      result = keyword_syncer.to_google_json
      expect(result[:match_type]).to eq(:BROAD)
    end

    it 'transforms match_type "phrase" to :PHRASE' do
      ad_keyword.match_type = "phrase"
      keyword_syncer.instance_variable_set(:@attrs, nil)
      result = keyword_syncer.to_google_json
      expect(result[:match_type]).to eq(:PHRASE)
    end

    it 'transforms match_type "exact" to :EXACT' do
      ad_keyword.match_type = "exact"
      keyword_syncer.instance_variable_set(:@attrs, nil)
      result = keyword_syncer.to_google_json
      expect(result[:match_type]).to eq(:EXACT)
    end

    it 'returns complete hash with all keyword fields' do
      result = keyword_syncer.to_google_json
      expect(result.keys).to contain_exactly(:text, :match_type)
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # #from_google_json (FieldMappable)
  # ═══════════════════════════════════════════════════════════════

  describe '#from_google_json' do
    def build_keyword_mock(text:, match_type:)
      keyword_info = double("KeywordInfo", text: text, match_type: match_type)
      double("AdGroupCriterion", keyword: keyword_info)
    end

    it 'reverse transforms remote values to local format' do
      remote = build_keyword_mock(text: "my keyword", match_type: :EXACT)

      result = keyword_syncer.from_google_json(remote)

      expect(result[:text]).to eq("my keyword")
      expect(result[:match_type]).to eq("exact")
    end

    it 'reverse transforms all match types' do
      { BROAD: "broad", PHRASE: "phrase", EXACT: "exact" }.each do |remote_type, local_type|
        remote = build_keyword_mock(text: "test", match_type: remote_type)
        result = keyword_syncer.from_google_json(remote)
        expect(result[:match_type]).to eq(local_type)
      end
    end
  end

  describe '#fetch' do
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

        remote = keyword_syncer.fetch
        expect(remote.criterion_id).to eq(333)
        expect(remote.keyword.text).to eq("test keyword")
        expect(remote.keyword.match_type).to eq(:BROAD)
      end
    end

    context 'when criterion ID is not set' do
      it 'returns nil' do
        expect(keyword_syncer.fetch).to be_nil
      end
    end

    context 'when criterion does not exist remotely' do
      before do
        ad_keyword.platform_settings["google"]["criterion_id"] = 333
        ad_keyword.save!
      end

      it 'returns nil' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        expect(keyword_syncer.fetch).to be_nil
      end
    end
  end

  describe '#synced?' do
    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          ad_group_criterion: @mock_ad_group_criterion_service)
      )
    end

    context 'when no criterion ID' do
      it 'returns false' do
        expect(keyword_syncer.synced?).to be false
      end
    end

    context 'when values match' do
      before do
        ad_keyword.platform_settings["google"]["criterion_id"] = 333
        ad_keyword.save!
      end

      it 'returns true' do
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
    end

    context 'when values do not match' do
      before do
        ad_keyword.platform_settings["google"]["criterion_id"] = 333
        ad_keyword.save!
      end

      it 'returns false' do
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

    context 'when remote status is REMOVED' do
      before do
        ad_keyword.platform_settings["google"]["criterion_id"] = 333
        ad_keyword.save!
      end

      it 'returns false' do
        criterion_response = mock_search_response_with_keyword(
          criterion_id: 333,
          ad_group_id: 999,
          customer_id: 1234567890,
          keyword_text: "test keyword",
          match_type: :BROAD,
          status: :REMOVED
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

        expect(keyword_syncer.synced?).to be false
      end
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

      it 'returns unchanged result without making API calls' do
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
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.unchanged?).to be true
      end
    end

    context 'when remote criterion does not exist' do
      before do
        ad_keyword.platform_settings["google"].delete("criterion_id")
        ad_keyword.save!
      end

      it 'creates a new criterion' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        mock_criterion = mock_ad_group_criterion_resource
        mock_keyword_info = mock_keyword_info_resource
        allow(@mock_resource).to receive(:keyword_info).and_yield(mock_keyword_info).and_return(mock_keyword_info)
        allow(mock_create_resource).to receive(:ad_group_criterion).and_yield(mock_criterion)

        mutate_response = mock_mutate_ad_group_criterion_response(criterion_id: 444, ad_group_id: 999, customer_id: 1234567890)
        allow(@mock_ad_group_criterion_service).to receive(:mutate_ad_group_criteria)
          .and_return(mutate_response)

        result = keyword_syncer.sync
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.created?).to be true
        expect(result.resource_name).to eq(444)
        expect(keyword_syncer.record.google_criterion_id).to eq(444)
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
        remote_broad_response = mock_search_response_with_keyword(
          criterion_id: 333,
          ad_group_id: 999,
          customer_id: 1234567890,
          keyword_text: "test keyword",
          match_type: :BROAD,
          status: :ENABLED
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(remote_broad_response)

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
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.updated?).to be true
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

    context 'when remote status is REMOVED' do
      before do
        ad_keyword.platform_settings["google"]["criterion_id"] = 333
        ad_keyword.save!
      end

      it 'creates new criterion when remote status is REMOVED' do
        removed_criterion_response = mock_search_response_with_keyword(
          criterion_id: 333,
          ad_group_id: 999,
          customer_id: 1234567890,
          keyword_text: "test keyword",
          match_type: :BROAD,
          status: :REMOVED
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(removed_criterion_response)

        mock_criterion = mock_ad_group_criterion_resource
        mock_keyword_info = mock_keyword_info_resource
        allow(@mock_resource).to receive(:keyword_info).and_yield(mock_keyword_info).and_return(mock_keyword_info)
        allow(mock_create_resource).to receive(:ad_group_criterion).and_yield(mock_criterion)

        mutate_response = mock_mutate_ad_group_criterion_response(criterion_id: 555, ad_group_id: 999, customer_id: 1234567890)
        allow(@mock_ad_group_criterion_service).to receive(:mutate_ad_group_criteria)
          .and_return(mutate_response)

        result = keyword_syncer.sync
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.created?).to be true
        expect(keyword_syncer.record.google_criterion_id).to eq(555)
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

    context 'when no criterion ID' do
      before do
        ad_keyword.platform_settings["google"].delete("criterion_id")
        ad_keyword.save!
      end

      it 'returns not_found result' do
        result = keyword_syncer.delete
        expect(result.not_found?).to be true
        expect(result.resource_type).to eq(:ad_group_criterion)
      end
    end

    context 'when criterion ID exists' do
      before do
        ad_keyword.platform_settings["google"]["criterion_id"] = 333
        ad_keyword.save!
      end

      it 'deletes the criterion and returns deleted result' do
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
        expect(keyword_syncer.record.google_criterion_id).to be_nil
      end

      it 'persists the nil google_criterion_id to the database' do
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

  describe '#compare_fields' do
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

    it 'returns match when all fields match' do
      criterion_response = mock_search_response_with_keyword(
        criterion_id: 333,
        ad_group_id: 999,
        customer_id: 1234567890,
        keyword_text: "test keyword",
        match_type: :BROAD,
        status: :ENABLED
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

      remote = keyword_syncer.fetch
      comparison = keyword_syncer.compare_fields(remote)
      expect(comparison.match?).to be true
    end

    it 'detects match_type mismatch' do
      ad_keyword.match_type = "exact"
      ad_keyword.save!

      criterion_response = mock_search_response_with_keyword(
        criterion_id: 333,
        ad_group_id: 999,
        customer_id: 1234567890,
        keyword_text: "test keyword",
        match_type: :BROAD,
        status: :ENABLED
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

      remote = keyword_syncer.fetch
      comparison = keyword_syncer.compare_fields(remote)
      expect(comparison.match?).to be false
      expect(comparison.failures).to include(:match_type)
    end

    it 'detects text mismatch' do
      ad_keyword.text = "different keyword"
      ad_keyword.save!

      criterion_response = mock_search_response_with_keyword(
        criterion_id: 333,
        ad_group_id: 999,
        customer_id: 1234567890,
        keyword_text: "test keyword",
        match_type: :BROAD,
        status: :ENABLED
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(criterion_response)

      remote = keyword_syncer.fetch
      comparison = keyword_syncer.compare_fields(remote)
      expect(comparison.match?).to be false
      expect(comparison.failures).to include(:text)
    end
  end

  describe 'AdKeyword model helper methods' do
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

    describe '#google_sync' do
      it 'returns unchanged when already synced' do
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
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.unchanged?).to be true
      end
    end
  end

  describe 'save_criterion_id after create' do
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

    it 'sets google_criterion_id from response after sync' do
      allow(@mock_google_ads_service).to receive(:search)
        .and_return(mock_empty_search_response)

      mock_criterion = mock_ad_group_criterion_resource
      mock_keyword_info = mock_keyword_info_resource
      allow(@mock_resource).to receive(:keyword_info).and_yield(mock_keyword_info).and_return(mock_keyword_info)
      allow(mock_create_resource).to receive(:ad_group_criterion).and_yield(mock_criterion)

      mutate_response = mock_mutate_ad_group_criterion_response(criterion_id: 555, ad_group_id: 999, customer_id: 1234567890)
      allow(@mock_ad_group_criterion_service).to receive(:mutate_ad_group_criteria)
        .and_return(mutate_response)

      ad_keyword.google_sync
      expect(ad_keyword.reload.google_criterion_id).to eq(555)
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # Instrumentation
  # ═══════════════════════════════════════════════════════════════

  describe 'instrumentation' do
    before do
      ad_keyword.google_criterion_id = 123
      ad_keyword.save!
    end

    it 'includes Instrumentable' do
      expect(described_class.ancestors.map(&:name)).to include('GoogleAds::Resources::Instrumentable')
    end

    it 'wraps fetch with instrumentation context' do
      keyword_response = mock_search_response_with_keyword(
        criterion_id: 123,
        keyword_text: "test keyword",
        match_type: :BROAD
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(keyword_response)

      expect(GoogleAds::Instrumentation).to receive(:with_context)
        .with(keyword: ad_keyword)
        .at_least(:once)
        .and_call_original

      keyword_syncer.fetch
    end

    it 'tags logs with keyword_id and ad_group_id' do
      keyword_response = mock_search_response_with_keyword(
        criterion_id: 123,
        keyword_text: "test keyword",
        match_type: :BROAD
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(keyword_response)

      # Instrumentation formats tags as "key=value" strings for log aggregator compatibility
      expect(GoogleAds::Instrumentation.google_ads_logger).to receive(:tagged).with(
        "keyword_id=#{ad_keyword.id}",
        "ad_group_id=#{ad_keyword.ad_group_id}"
      ).at_least(:once).and_yield

      keyword_syncer.fetch
    end

    it 'wraps sync with instrumentation context' do
      keyword_response = mock_search_response_with_keyword(
        criterion_id: 123,
        keyword_text: "test keyword",
        match_type: :BROAD
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(keyword_response)

      expect(GoogleAds::Instrumentation).to receive(:with_context)
        .with(keyword: ad_keyword)
        .at_least(:once)
        .and_call_original

      keyword_syncer.sync
    end

    it 'wraps sync_result with instrumentation context' do
      keyword_response = mock_search_response_with_keyword(
        criterion_id: 123,
        keyword_text: "test keyword",
        match_type: :BROAD
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(keyword_response)

      expect(GoogleAds::Instrumentation).to receive(:with_context)
        .with(keyword: ad_keyword)
        .at_least(:once)
        .and_call_original

      keyword_syncer.sync_result
    end

    it 'wraps sync_plan with instrumentation context' do
      keyword_response = mock_search_response_with_keyword(
        criterion_id: 123,
        keyword_text: "test keyword",
        match_type: :BROAD
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(keyword_response)

      expect(GoogleAds::Instrumentation).to receive(:with_context)
        .with(keyword: ad_keyword)
        .at_least(:once)
        .and_call_original

      keyword_syncer.sync_plan
    end

    it 'wraps delete with instrumentation context' do
      keyword_response = mock_search_response_with_keyword(
        criterion_id: 123,
        keyword_text: "test keyword",
        match_type: :BROAD
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(keyword_response)

      mock_remove_operation = double("RemoveOperation")
      allow(@mock_remove_resource).to receive(:ad_group_criterion)
        .and_return(mock_remove_operation)

      mutate_response = mock_mutate_ad_group_criterion_response(criterion_id: 123, ad_group_id: 999, customer_id: 1234567890)
      allow(@mock_ad_group_criterion_service).to receive(:mutate_ad_group_criteria)
        .and_return(mutate_response)

      expect(GoogleAds::Instrumentation).to receive(:with_context)
        .with(keyword: ad_keyword)
        .at_least(:once)
        .and_call_original

      keyword_syncer.delete
    end
  end
end
