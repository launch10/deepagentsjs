require 'rails_helper'

RSpec.describe GoogleAds::StructuredSnippet do
  include GoogleAdsMocks

  let(:account) { create(:account) }
  let(:campaign) { create(:campaign, account: account) }
  let(:structured_snippet) do
    create(:ad_structured_snippet,
      campaign: campaign,
      category: "services",
      values: ["Web Design", "SEO", "Marketing"])
  end
  let(:snippet_syncer) { described_class.new(structured_snippet) }

  before do
    mock_google_ads_client
    allow(campaign).to receive(:google_customer_id).and_return("1234567890")
    allow(campaign).to receive(:google_campaign_id).and_return(789)
  end

  describe '#local_resource' do
    it 'returns the structured_snippet passed to the syncer' do
      expect(snippet_syncer.local_resource).to eq(structured_snippet)
    end
  end

  describe '#campaign' do
    it 'returns the campaign from the structured_snippet' do
      expect(snippet_syncer.campaign).to eq(campaign)
    end
  end

  describe '#fetch_remote' do
    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          asset: @mock_asset_service,
          campaign_asset: @mock_campaign_asset_service)
      )
    end

    context 'when asset exists by ID' do
      before do
        structured_snippet.platform_settings["google"]["asset_id"] = 88888
        structured_snippet.save!
      end

      it 'fetches the remote asset by ID' do
        asset_response = mock_search_response_with_structured_snippet_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          header: "Service catalog",
          values: ["Web Design", "SEO", "Marketing"]
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        remote = snippet_syncer.fetch_remote
        expect(remote.id).to eq(88888)
        expect(remote.structured_snippet_asset.header).to eq("Service catalog")
        expect(remote.structured_snippet_asset.values).to eq(["Web Design", "SEO", "Marketing"])
      end
    end

    context 'when asset ID is missing but asset exists by content' do
      before do
        structured_snippet.platform_settings["google"] = {}
        structured_snippet.save!
      end

      it 'fetches the remote asset by header and values, and backfills the ID' do
        asset_response = mock_search_response_with_structured_snippet_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          header: "Service catalog",
          values: ["Web Design", "SEO", "Marketing"]
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        remote = snippet_syncer.fetch_remote
        expect(remote.id).to eq(88888)
        expect(remote.structured_snippet_asset.header).to eq("Service catalog")
        expect(structured_snippet.reload.google_asset_id).to eq("88888")
      end
    end

    context 'when asset does not exist remotely by ID or content' do
      before do
        structured_snippet.platform_settings["google"] = {}
        structured_snippet.save!
      end

      it 'returns nil' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        expect(snippet_syncer.fetch_remote).to be_nil
      end
    end
  end

  describe '#sync_result' do
    before do
      structured_snippet.platform_settings["google"]["asset_id"] = 88888
      structured_snippet.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          asset: @mock_asset_service,
          campaign_asset: @mock_campaign_asset_service)
      )
    end

    context 'when remote asset exists and matches local' do
      it 'returns synced result' do
        asset_response = mock_search_response_with_structured_snippet_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          header: "Service catalog",
          values: ["Web Design", "SEO", "Marketing"]
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        result = snippet_syncer.sync_result
        expect(result.synced?).to be true
        expect(result.action).to eq(:unchanged)
        expect(result.resource_type).to eq(:asset)
      end
    end

    context 'when remote asset exists but does not match local (values mismatch)' do
      before do
        structured_snippet.values = ["Different", "Values", "Here"]
        structured_snippet.save!
      end

      it 'returns unsynced result with mismatched fields' do
        asset_response = mock_search_response_with_structured_snippet_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          header: "Service catalog",
          values: ["Web Design", "SEO", "Marketing"]
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        result = snippet_syncer.sync_result
        expect(result.synced?).to be false
        expect(result.values_match?).to be false
        expect(result.mismatched_fields.map(&:our_field)).to include(:values)
      end
    end

    context 'when remote asset does not exist' do
      before do
        structured_snippet.platform_settings["google"].delete("asset_id")
        structured_snippet.save!
      end

      it 'returns not_found result' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        result = snippet_syncer.sync_result
        expect(result.not_found?).to be true
        expect(result.synced?).to be false
      end
    end
  end

  describe '#synced?' do
    before do
      structured_snippet.platform_settings["google"]["asset_id"] = 88888
      structured_snippet.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          asset: @mock_asset_service,
          campaign_asset: @mock_campaign_asset_service)
      )
    end

    it 'returns true when values match' do
      asset_response = mock_search_response_with_structured_snippet_asset(
        asset_id: 88888,
        customer_id: 1234567890,
        header: "Service catalog",
        values: ["Web Design", "SEO", "Marketing"]
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

      expect(snippet_syncer.synced?).to be true
    end

    it 'returns false when values do not match' do
      asset_response = mock_search_response_with_structured_snippet_asset(
        asset_id: 88888,
        customer_id: 1234567890,
        header: "Service catalog",
        values: ["Different", "Values", "Here"]
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

      expect(snippet_syncer.synced?).to be false
    end
  end

  describe '#sync' do
    let(:mock_create_resource) { double("CreateResource") }

    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          asset: @mock_asset_service,
          campaign_asset: @mock_campaign_asset_service)
      )
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    context 'when already synced' do
      before do
        structured_snippet.platform_settings["google"]["asset_id"] = 88888
        structured_snippet.save!
      end

      it 'returns sync_result without making API calls' do
        asset_response = mock_search_response_with_structured_snippet_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          header: "Service catalog",
          values: ["Web Design", "SEO", "Marketing"]
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        expect(@mock_asset_service).not_to receive(:mutate_assets)
        result = snippet_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end

    context 'when remote asset does not exist' do
      before do
        structured_snippet.platform_settings["google"].delete("asset_id")
        structured_snippet.save!
      end

      it 'creates asset and links to campaign' do
        created_asset_response = mock_search_response_with_structured_snippet_asset(
          asset_id: 99999,
          customer_id: 1234567890,
          header: "Service catalog",
          values: ["Web Design", "SEO", "Marketing"]
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response, created_asset_response)

        mock_asset = mock_asset_with_structured_snippet_resource
        mock_snippet_asset = mock_structured_snippet_asset_resource
        allow(@mock_resource).to receive(:structured_snippet_asset).and_yield(mock_snippet_asset).and_return(mock_snippet_asset)
        allow(mock_create_resource).to receive(:asset).and_yield(mock_asset)

        mutate_asset_response = mock_mutate_asset_response(asset_id: 99999, customer_id: 1234567890)
        allow(@mock_asset_service).to receive(:mutate_assets)
          .and_return(mutate_asset_response)

        mock_campaign_asset = mock_campaign_asset_resource
        allow(mock_create_resource).to receive(:campaign_asset).and_yield(mock_campaign_asset)

        mutate_campaign_asset_response = mock_mutate_campaign_asset_response(
          asset_id: 99999,
          campaign_id: 789,
          customer_id: 1234567890
        )
        allow(@mock_campaign_asset_service).to receive(:mutate_campaign_assets)
          .and_return(mutate_campaign_asset_response)

        result = snippet_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.created?).to be true
        expect(result.resource_name).to eq("customers/1234567890/assets/99999")
        expect(result.synced?).to be true
        expect(snippet_syncer.local_resource.google_asset_id).to eq(99999)
      end

      it 'returns error result when API call fails' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        mock_asset = mock_asset_with_structured_snippet_resource
        mock_snippet_asset = mock_structured_snippet_asset_resource
        allow(@mock_resource).to receive(:structured_snippet_asset).and_yield(mock_snippet_asset).and_return(mock_snippet_asset)
        allow(mock_create_resource).to receive(:asset).and_yield(mock_asset)

        allow(@mock_asset_service).to receive(:mutate_assets)
          .and_raise(mock_google_ads_error(message: "Asset creation failed"))

        result = snippet_syncer.sync
        expect(result.error?).to be true
      end
    end
  end

  describe 'AdStructuredSnippet helper methods' do
    before do
      structured_snippet.platform_settings["google"]["asset_id"] = 88888
      structured_snippet.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          asset: @mock_asset_service,
          campaign_asset: @mock_campaign_asset_service)
      )
    end

    describe '#google_synced?' do
      it 'delegates to the syncer' do
        asset_response = mock_search_response_with_structured_snippet_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          header: "Service catalog",
          values: ["Web Design", "SEO", "Marketing"]
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        expect(structured_snippet.google_synced?).to be true
      end
    end

    describe '#google_sync_result' do
      it 'returns the sync result' do
        asset_response = mock_search_response_with_structured_snippet_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          header: "Service catalog",
          values: ["Web Design", "SEO", "Marketing"]
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        result = structured_snippet.google_sync_result
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end

    describe '#google_sync' do
      it 'syncs the structured snippet' do
        asset_response = mock_search_response_with_structured_snippet_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          header: "Service catalog",
          values: ["Web Design", "SEO", "Marketing"]
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        result = structured_snippet.google_sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end
  end

  describe 'after_google_sync callback' do
    let(:mock_create_resource) { double("CreateResource") }

    before do
      structured_snippet.platform_settings["google"].delete("asset_id")
      structured_snippet.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          asset: @mock_asset_service,
          campaign_asset: @mock_campaign_asset_service)
      )
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    it 'sets google_asset_id from resource_name after sync' do
      created_asset_response = mock_search_response_with_structured_snippet_asset(
        asset_id: 77777,
        customer_id: 1234567890,
        header: "Service catalog",
        values: ["Web Design", "SEO", "Marketing"]
      )

      allow(@mock_google_ads_service).to receive(:search)
        .and_return(mock_empty_search_response, created_asset_response)

      mock_asset = mock_asset_with_structured_snippet_resource
      mock_snippet_asset = mock_structured_snippet_asset_resource
      allow(@mock_resource).to receive(:structured_snippet_asset).and_yield(mock_snippet_asset).and_return(mock_snippet_asset)
      allow(mock_create_resource).to receive(:asset).and_yield(mock_asset)

      mutate_asset_response = mock_mutate_asset_response(asset_id: 77777, customer_id: 1234567890)
      allow(@mock_asset_service).to receive(:mutate_assets)
        .and_return(mutate_asset_response)

      mock_campaign_asset = mock_campaign_asset_resource
      allow(mock_create_resource).to receive(:campaign_asset).and_yield(mock_campaign_asset)

      mutate_campaign_asset_response = mock_mutate_campaign_asset_response(
        asset_id: 77777,
        campaign_id: 789,
        customer_id: 1234567890
      )
      allow(@mock_campaign_asset_service).to receive(:mutate_campaign_assets)
        .and_return(mutate_campaign_asset_response)

      structured_snippet.google_sync
      expect(structured_snippet.reload.google_asset_id).to eq("77777")
    end
  end
end
