require 'rails_helper'

RSpec.describe GoogleAds::Callout do
  include GoogleAdsMocks

  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, account: account, project: project) }
  let(:campaign) { create(:campaign, account: account, project: project, website: website) }
  let(:ad_group) { create(:ad_group, campaign: campaign) }
  let(:callout) do
    create(:ad_callout,
      campaign: campaign,
      ad_group: ad_group,
      text: "Free Shipping",
      position: 0,
      platform_settings: { "google" => {} })
  end
  let(:callout_syncer) { described_class.new(callout) }

  before do
    mock_google_ads_client
    allow_any_instance_of(Campaign).to receive(:google_customer_id).and_return("1234567890")
    allow_any_instance_of(Campaign).to receive(:google_campaign_id).and_return(789)
  end

  describe '#local_resource' do
    it 'returns the callout passed to the syncer' do
      expect(callout_syncer.local_resource).to eq(callout)
    end
  end

  describe '#campaign' do
    it 'returns the campaign from the callout' do
      expect(callout_syncer.campaign).to eq(campaign)
    end
  end

  describe '#fetch_remote' do
    context 'when asset exists by ID' do
      before do
        callout.platform_settings["google"]["asset_id"] = "88888"
        callout.save!
      end

      it 'fetches the remote asset by ID' do
        asset_response = mock_search_response_with_callout_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          callout_text: "Free Shipping"
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        remote = callout_syncer.fetch_remote
        expect(remote.id).to eq(88888)
        expect(remote.callout_asset.callout_text).to eq("Free Shipping")
      end
    end

    context 'when asset ID is missing but asset exists by content' do
      before do
        callout.platform_settings["google"] = {}
        callout.save!
      end

      it 'fetches the remote asset by callout text and backfills the ID' do
        asset_response = mock_search_response_with_callout_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          callout_text: "Free Shipping"
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        remote = callout_syncer.fetch_remote
        expect(remote.id).to eq(88888)
        expect(remote.callout_asset.callout_text).to eq("Free Shipping")
        expect(callout.reload.google_asset_id).to eq("88888")
      end
    end

    context 'when asset does not exist remotely by ID or content' do
      before do
        callout.platform_settings["google"] = {}
        callout.save!
      end

      it 'returns nil' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        expect(callout_syncer.fetch_remote).to be_nil
      end
    end
  end

  describe '#sync_result' do
    before do
      callout.platform_settings["google"]["asset_id"] = "88888"
      callout.save!
    end

    context 'when remote asset exists and matches local' do
      it 'returns synced result' do
        asset_response = mock_search_response_with_callout_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          callout_text: "Free Shipping"
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        result = callout_syncer.sync_result
        expect(result.synced?).to be true
        expect(result.action).to eq(:unchanged)
        expect(result.resource_type).to eq(:asset)
      end
    end

    context 'when remote asset does not exist' do
      before do
        callout.platform_settings["google"].delete("asset_id")
        callout.save!
      end

      it 'returns not_found result' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        result = callout_syncer.sync_result
        expect(result.not_found?).to be true
        expect(result.synced?).to be false
      end
    end
  end

  describe '#synced?' do
    before do
      callout.platform_settings["google"]["asset_id"] = "88888"
      callout.save!
    end

    it 'returns true when text matches' do
      asset_response = mock_search_response_with_callout_asset(
        asset_id: 88888,
        customer_id: 1234567890,
        callout_text: "Free Shipping"
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

      expect(callout_syncer.synced?).to be true
    end

    it 'returns false when text does not match' do
      asset_response = mock_search_response_with_callout_asset(
        asset_id: 88888,
        customer_id: 1234567890,
        callout_text: "Different Text"
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

      expect(callout_syncer.synced?).to be false
    end
  end

  describe '#sync' do
    let(:mock_create_resource) { double("CreateResource") }

    before do
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    context 'when already synced' do
      before do
        callout.platform_settings["google"]["asset_id"] = "88888"
        callout.save!
      end

      it 'returns sync_result without making API calls' do
        asset_response = mock_search_response_with_callout_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          callout_text: "Free Shipping"
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        expect(@mock_asset_service).not_to receive(:mutate_assets)
        result = callout_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end

    context 'when remote asset does not exist' do
      before do
        callout.platform_settings["google"] = {}
        callout.save!
      end

      it 'creates a new asset and links to campaign' do
        created_asset_response = mock_search_response_with_callout_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          callout_text: "Free Shipping"
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response, created_asset_response)

        mock_asset = mock_asset_with_callout_resource
        mock_callout = mock_callout_asset_resource
        mock_campaign_asset = mock_campaign_asset_resource

        expect(mock_callout).to receive(:callout_text=).with("Free Shipping")
        expect(mock_campaign_asset).to receive(:campaign=).with("customers/1234567890/campaigns/789")
        expect(mock_campaign_asset).to receive(:asset=).with("customers/1234567890/assets/88888")
        expect(mock_campaign_asset).to receive(:field_type=).with(:CALLOUT)

        allow(@mock_resource).to receive(:callout_asset).and_yield(mock_callout).and_return(mock_callout)
        allow(mock_create_resource).to receive(:asset).and_yield(mock_asset)
        allow(mock_create_resource).to receive(:campaign_asset).and_yield(mock_campaign_asset)

        mutate_asset_response = mock_mutate_asset_response(asset_id: 88888, customer_id: 1234567890)
        mutate_campaign_asset_response = mock_mutate_campaign_asset_response(
          asset_id: 88888,
          campaign_id: 789,
          customer_id: 1234567890
        )

        allow(@mock_asset_service).to receive(:mutate_assets)
          .and_return(mutate_asset_response)
        allow(@mock_campaign_asset_service).to receive(:mutate_campaign_assets)
          .and_return(mutate_campaign_asset_response)

        result = callout_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.created?).to be true
        expect(result.resource_name).to eq("customers/1234567890/assets/88888")
        expect(result.synced?).to be true
        expect(callout_syncer.local_resource.google_asset_id).to eq(88888)
      end

      it 'returns error result when asset creation fails' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        mock_asset = mock_asset_with_callout_resource
        mock_callout = mock_callout_asset_resource
        allow(@mock_resource).to receive(:callout_asset).and_yield(mock_callout).and_return(mock_callout)
        allow(mock_create_resource).to receive(:asset).and_yield(mock_asset)

        allow(@mock_asset_service).to receive(:mutate_assets)
          .and_raise(mock_google_ads_error(message: "Asset creation failed"))

        result = callout_syncer.sync
        expect(result.error?).to be true
      end

      it 'returns error result when campaign asset linking fails' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        mock_asset = mock_asset_with_callout_resource
        mock_callout = mock_callout_asset_resource
        mock_campaign_asset = mock_campaign_asset_resource

        allow(@mock_resource).to receive(:callout_asset).and_yield(mock_callout).and_return(mock_callout)
        allow(mock_create_resource).to receive(:asset).and_yield(mock_asset)
        allow(mock_create_resource).to receive(:campaign_asset).and_yield(mock_campaign_asset)

        mutate_asset_response = mock_mutate_asset_response(asset_id: 88888, customer_id: 1234567890)
        allow(@mock_asset_service).to receive(:mutate_assets)
          .and_return(mutate_asset_response)
        allow(@mock_campaign_asset_service).to receive(:mutate_campaign_assets)
          .and_raise(mock_google_ads_error(message: "Campaign asset linking failed"))

        result = callout_syncer.sync
        expect(result.error?).to be true
      end
    end
  end

  describe 'AdCallout model helper methods' do
    before do
      callout.platform_settings["google"]["asset_id"] = "88888"
      callout.save!
    end

    describe '#google_synced?' do
      it 'delegates to the syncer' do
        asset_response = mock_search_response_with_callout_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          callout_text: "Free Shipping"
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        expect(callout.google_synced?).to be true
      end
    end

    describe '#google_sync_result' do
      it 'returns the sync result' do
        asset_response = mock_search_response_with_callout_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          callout_text: "Free Shipping"
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        result = callout.google_sync_result
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end

    describe '#google_sync' do
      it 'syncs the callout' do
        asset_response = mock_search_response_with_callout_asset(
          asset_id: 88888,
          customer_id: 1234567890,
          callout_text: "Free Shipping"
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        result = callout.google_sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end
  end

  describe 'after_google_sync callback' do
    let(:mock_create_resource) { double("CreateResource") }

    before do
      callout.platform_settings["google"] = {}
      callout.save!
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    it 'sets google_asset_id from resource_name after sync' do
      created_asset_response = mock_search_response_with_callout_asset(
        asset_id: 99999,
        customer_id: 1234567890,
        callout_text: "Free Shipping"
      )

      allow(@mock_google_ads_service).to receive(:search)
        .and_return(mock_empty_search_response, created_asset_response)

      mock_asset = mock_asset_with_callout_resource
      mock_callout = mock_callout_asset_resource
      mock_campaign_asset = mock_campaign_asset_resource

      allow(@mock_resource).to receive(:callout_asset).and_yield(mock_callout).and_return(mock_callout)
      allow(mock_create_resource).to receive(:asset).and_yield(mock_asset)
      allow(mock_create_resource).to receive(:campaign_asset).and_yield(mock_campaign_asset)

      mutate_asset_response = mock_mutate_asset_response(asset_id: 99999, customer_id: 1234567890)
      mutate_campaign_asset_response = mock_mutate_campaign_asset_response(
        asset_id: 99999,
        campaign_id: 789,
        customer_id: 1234567890
      )

      allow(@mock_asset_service).to receive(:mutate_assets)
        .and_return(mutate_asset_response)
      allow(@mock_campaign_asset_service).to receive(:mutate_campaign_assets)
        .and_return(mutate_campaign_asset_response)

      callout.google_sync
      expect(callout.reload.google_asset_id).to eq("99999")
    end
  end
end
