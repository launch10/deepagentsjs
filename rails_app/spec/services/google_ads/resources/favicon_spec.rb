require 'rails_helper'

RSpec.describe GoogleAds::Resources::Favicon do
  include GoogleAdsMocks

  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, account: account, project: project) }
  let!(:domain) { create(:domain, account: account, domain: "test-site.launch10.ai") }
  let!(:website_url) { create(:website_url, domain: domain, website: website, account: account) }
  let(:campaign) { create(:campaign, account: account, project: project, website: website) }
  let(:upload) do
    upload = create(:upload, account: account, is_logo: true)
    create(:website_upload, website: website, upload: upload)
    upload.reload
  end
  let(:favicon_syncer) { described_class.new(upload, campaign: campaign) }

  before do
    mock_google_ads_client
    allow_any_instance_of(Campaign).to receive(:google_customer_id).and_return("1234567890")
    allow_any_instance_of(Campaign).to receive(:google_campaign_id).and_return(789)
  end

  describe '#record' do
    it 'returns the upload passed to the syncer' do
      expect(favicon_syncer.record).to eq(upload)
    end
  end

  describe '#campaign' do
    it 'returns the campaign from the website' do
      expect(favicon_syncer.campaign).to eq(campaign)
    end
  end

  describe '#fetch' do
    context 'when asset exists by ID' do
      before do
        upload.google_asset_id = 77777
        upload.save!
      end

      it 'fetches the remote asset by ID' do
        asset_response = mock_search_response_with_asset(
          asset_id: 77777,
          customer_id: 1234567890,
          name: "Test Campaign Business Logo",
          type: :IMAGE,
          file_size: 1024,
          mime_type: :IMAGE_PNG
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        remote = favicon_syncer.fetch
        expect(remote.id).to eq(77777)
        expect(remote.type).to eq(:IMAGE)
      end
    end

    context 'when asset ID is not set' do
      before do
        upload.google_asset_id = nil
        upload.save!
      end

      it 'returns nil' do
        expect(favicon_syncer.fetch).to be_nil
      end
    end

    context 'when asset does not exist remotely' do
      before do
        upload.google_asset_id = 77777
        upload.save!
      end

      it 'returns nil' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        expect(favicon_syncer.fetch).to be_nil
      end
    end
  end

  describe '#synced?' do
    context 'when no asset ID' do
      before do
        upload.google_asset_id = nil
        upload.save!
      end

      it 'returns false' do
        expect(favicon_syncer.synced?).to be false
      end
    end

    context 'when asset exists remotely' do
      before do
        upload.google_asset_id = 77777
        upload.save!
      end

      it 'returns true' do
        asset_response = mock_search_response_with_asset(
          asset_id: 77777,
          customer_id: 1234567890
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        expect(favicon_syncer.synced?).to be true
      end
    end

    context 'when asset ID exists but not found in Google (stale ID)' do
      before do
        upload.google_asset_id = 77777
        upload.save!
      end

      it 'returns false' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        expect(favicon_syncer.synced?).to be false
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
        upload.google_asset_id = 77777
        upload.save!
      end

      it 'returns unchanged result without making API calls' do
        asset_response = mock_search_response_with_asset(
          asset_id: 77777,
          customer_id: 1234567890
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(asset_response)

        expect(@mock_asset_service).not_to receive(:mutate_assets)
        result = favicon_syncer.sync
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.unchanged?).to be true
      end
    end

    context 'when remote asset does not exist' do
      before do
        upload.google_asset_id = nil
        upload.save!
      end

      it 'creates a new image asset and links to campaign' do
        created_asset_response = mock_search_response_with_asset(
          asset_id: 77777,
          customer_id: 1234567890,
          name: "Test Campaign Business Logo"
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response, created_asset_response)

        mock_asset = mock_asset_resource
        mock_image = mock_image_asset_resource
        mock_dim = mock_image_dimension_resource
        mock_campaign_asset = mock_campaign_asset_resource

        expect(mock_asset).to receive(:name=).with("#{campaign.name} Business Logo")
        expect(mock_asset).to receive(:type=).with(:IMAGE)
        expect(mock_asset).to receive(:image_asset=).with(mock_image)

        allow(@mock_resource).to receive(:image_asset).and_yield(mock_image).and_return(mock_image)
        allow(@mock_resource).to receive(:image_dimension).and_yield(mock_dim).and_return(mock_dim)
        allow(mock_create_resource).to receive(:asset).and_yield(mock_asset)

        mutate_asset_response = mock_mutate_asset_response(asset_id: 77777, customer_id: 1234567890)
        allow(@mock_asset_service).to receive(:mutate_assets)
          .and_return(mutate_asset_response)

        expect(mock_campaign_asset).to receive(:campaign=).with("customers/1234567890/campaigns/789")
        expect(mock_campaign_asset).to receive(:asset=).with("customers/1234567890/assets/77777")
        expect(mock_campaign_asset).to receive(:field_type=).with(:BUSINESS_LOGO)

        allow(mock_create_resource).to receive(:campaign_asset).and_yield(mock_campaign_asset)
        mutate_campaign_asset_response = mock_mutate_campaign_asset_response(
          asset_id: 77777,
          campaign_id: 789,
          customer_id: 1234567890
        )
        allow(@mock_campaign_asset_service).to receive(:mutate_campaign_assets)
          .and_return(mutate_campaign_asset_response)

        allow(favicon_syncer).to receive(:fetch_image_data).and_return({
          data: Base64.strict_encode64("fake image data"),
          file_size: 15,
          mime_type: :IMAGE_JPEG,
          width: 128,
          height: 128
        })

        result = favicon_syncer.sync
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.created?).to be true
        expect(result.resource_name).to eq(77777)
        expect(favicon_syncer.record.google_asset_id).to eq(77777)
      end

      it 'returns error result when asset creation fails' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        mock_asset = mock_asset_resource
        mock_image = mock_image_asset_resource
        mock_dim = mock_image_dimension_resource
        allow(@mock_resource).to receive(:image_asset).and_yield(mock_image).and_return(mock_image)
        allow(@mock_resource).to receive(:image_dimension).and_yield(mock_dim).and_return(mock_dim)
        allow(mock_create_resource).to receive(:asset).and_yield(mock_asset)

        allow(@mock_asset_service).to receive(:mutate_assets)
          .and_raise(mock_google_ads_error(message: "Asset creation failed"))

        allow(favicon_syncer).to receive(:fetch_image_data).and_return({
          data: Base64.strict_encode64("fake image data"),
          file_size: 15,
          mime_type: :IMAGE_JPEG,
          width: 128,
          height: 128
        })

        result = favicon_syncer.sync
        expect(result.error?).to be true
      end

      it 'returns error result when image data cannot be fetched' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        allow(favicon_syncer).to receive(:fetch_image_data).and_return(nil)

        result = favicon_syncer.sync
        expect(result.error?).to be true
      end

      it 'returns error result when campaign asset linking fails' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        mock_asset = mock_asset_resource
        mock_image = mock_image_asset_resource
        mock_dim = mock_image_dimension_resource
        mock_campaign_asset = mock_campaign_asset_resource

        allow(@mock_resource).to receive(:image_asset).and_yield(mock_image).and_return(mock_image)
        allow(@mock_resource).to receive(:image_dimension).and_yield(mock_dim).and_return(mock_dim)
        allow(mock_create_resource).to receive(:asset).and_yield(mock_asset)
        allow(mock_create_resource).to receive(:campaign_asset).and_yield(mock_campaign_asset)

        mutate_asset_response = mock_mutate_asset_response(asset_id: 77777, customer_id: 1234567890)
        allow(@mock_asset_service).to receive(:mutate_assets)
          .and_return(mutate_asset_response)

        allow(@mock_campaign_asset_service).to receive(:mutate_campaign_assets)
          .and_raise(mock_google_ads_error(message: "Campaign asset linking failed"))

        allow(favicon_syncer).to receive(:fetch_image_data).and_return({
          data: Base64.strict_encode64("fake image data"),
          file_size: 15,
          mime_type: :IMAGE_JPEG,
          width: 128,
          height: 128
        })

        result = favicon_syncer.sync
        expect(result.error?).to be true
      end
    end
  end

  describe '#delete' do
    let(:mock_remove_resource) { double("RemoveResource") }

    before do
      allow(@mock_operation).to receive(:remove_resource).and_return(mock_remove_resource)
    end

    context 'when no asset ID' do
      before do
        upload.google_asset_id = nil
        upload.save!
      end

      it 'returns not_found result' do
        result = favicon_syncer.delete
        expect(result.not_found?).to be true
        expect(result.resource_type).to eq(:campaign_asset)
      end
    end

    context 'when asset ID exists' do
      before do
        upload.google_asset_id = 77777
        upload.save!
      end

      it 'deletes the campaign_asset link and clears the local ID' do
        mock_remove_operation = double("RemoveOperation")
        allow(mock_remove_resource).to receive(:campaign_asset)
          .with("customers/1234567890/campaignAssets/789~77777~BUSINESS_LOGO")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_campaign_asset_response(
          asset_id: 77777,
          campaign_id: 789,
          customer_id: 1234567890
        )
        allow(@mock_campaign_asset_service).to receive(:mutate_campaign_assets)
          .and_return(mutate_response)

        result = favicon_syncer.delete
        expect(result.deleted?).to be true
        expect(result.resource_type).to eq(:campaign_asset)
        expect(favicon_syncer.record.google_asset_id).to be_nil
      end

      it 'persists the nil google_asset_id to the database' do
        mock_remove_operation = double("RemoveOperation")
        allow(mock_remove_resource).to receive(:campaign_asset)
          .with("customers/1234567890/campaignAssets/789~77777~BUSINESS_LOGO")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_campaign_asset_response(
          asset_id: 77777,
          campaign_id: 789,
          customer_id: 1234567890
        )
        allow(@mock_campaign_asset_service).to receive(:mutate_campaign_assets)
          .and_return(mutate_response)

        favicon_syncer.delete

        fresh_upload = Upload.find(upload.id)
        expect(fresh_upload.google_asset_id).to be_nil
      end

      it 'returns error result when API call fails' do
        mock_remove_operation = double("RemoveOperation")
        allow(mock_remove_resource).to receive(:campaign_asset)
          .with("customers/1234567890/campaignAssets/789~77777~BUSINESS_LOGO")
          .and_return(mock_remove_operation)

        allow(@mock_campaign_asset_service).to receive(:mutate_campaign_assets)
          .and_raise(mock_google_ads_error(message: "Campaign asset deletion failed"))

        result = favicon_syncer.delete
        expect(result.error?).to be true
      end
    end
  end

  describe '#compare_fields' do
    it 'returns empty FieldCompare (no field comparison for binary images)' do
      # For binary images, there's no content-based comparison
      remote = double("remote")
      comparison = favicon_syncer.compare_fields(remote)
      expect(comparison.match?).to be true
      expect(comparison.failures).to be_empty
    end
  end

  describe 'save_asset_id after create' do
    let(:mock_create_resource) { double("CreateResource") }

    before do
      upload.google_asset_id = nil
      upload.save!
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    it 'sets google_asset_id from response after sync' do
      allow(@mock_google_ads_service).to receive(:search)
        .and_return(mock_empty_search_response)

      mock_asset = mock_asset_resource
      mock_image = mock_image_asset_resource
      mock_dim = mock_image_dimension_resource
      mock_campaign_asset = mock_campaign_asset_resource

      allow(@mock_resource).to receive(:image_asset).and_yield(mock_image).and_return(mock_image)
      allow(@mock_resource).to receive(:image_dimension).and_yield(mock_dim).and_return(mock_dim)
      allow(mock_create_resource).to receive(:asset).and_yield(mock_asset)
      allow(mock_create_resource).to receive(:campaign_asset).and_yield(mock_campaign_asset)

      mutate_asset_response = mock_mutate_asset_response(asset_id: 99999, customer_id: 1234567890)
      allow(@mock_asset_service).to receive(:mutate_assets)
        .and_return(mutate_asset_response)

      mutate_campaign_asset_response = mock_mutate_campaign_asset_response(
        asset_id: 99999,
        campaign_id: 789,
        customer_id: 1234567890
      )
      allow(@mock_campaign_asset_service).to receive(:mutate_campaign_assets)
        .and_return(mutate_campaign_asset_response)

      allow(favicon_syncer).to receive(:fetch_image_data).and_return({
        data: Base64.strict_encode64("fake image data"),
        file_size: 15,
        mime_type: :IMAGE_JPEG,
        width: 128,
        height: 128
      })

      favicon_syncer.sync
      expect(upload.reload.google_asset_id).to eq(99999)
    end
  end
end
