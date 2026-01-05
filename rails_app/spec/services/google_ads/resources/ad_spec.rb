require 'rails_helper'

RSpec.describe GoogleAds::Resources::Ad do
  include GoogleAdsMocks

  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, account: account, project: project) }
  let!(:domain) { create(:domain, website: website, account: account, domain: "test-site.launch10.ai") }
  let(:campaign) { create(:campaign, account: account, project: project, website: website) }
  let(:ad_group) { create(:ad_group, campaign: campaign) }
  let(:ad) do
    ad = create(:ad, ad_group: ad_group, status: "draft", display_path_1: "Shop", display_path_2: "Now")
    create(:ad_headline, ad: ad, text: "Great Products", position: 0)
    create(:ad_headline, ad: ad, text: "Buy Today", position: 1)
    create(:ad_headline, ad: ad, text: "Best Deals", position: 2)
    create(:ad_description, ad: ad, text: "Amazing deals on all products", position: 0)
    create(:ad_description, ad: ad, text: "Shop now and save big", position: 1)
    ad.reload
  end
  let(:ad_syncer) { described_class.new(ad) }

  before do
    mock_google_ads_client
    allow_any_instance_of(Campaign).to receive(:google_customer_id).and_return("1234567890")
    allow_any_instance_of(AdGroup).to receive(:google_ad_group_id).and_return(999)
  end

  describe '#record' do
    it 'returns the ad passed to the syncer' do
      expect(ad_syncer.record).to eq(ad)
    end
  end

  describe '#fetch' do
    context 'when ad exists by ID' do
      before do
        ad.platform_settings["google"] = { "ad_id" => "12345" }
        ad.save!
      end

      it 'fetches the remote ad by ID' do
        ad_response = mock_search_response_with_ad_group_ad(
          ad_id: 12345,
          ad_group_id: 999,
          customer_id: 1234567890,
          status: :PAUSED,
          final_urls: ["https://test-site.launch10.ai"],
          path1: "Shop",
          path2: "Now"
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_response)

        remote = ad_syncer.fetch
        expect(remote.ad.id).to eq(12345)
        expect(remote.status).to eq(:PAUSED)
      end
    end

    context 'when ad has no google_ad_id' do
      it 'returns nil' do
        expect(ad_syncer.fetch).to be_nil
      end
    end

    context 'when ad does not exist remotely' do
      before do
        ad.platform_settings["google"] = { "ad_id" => "12345" }
        ad.save!
      end

      it 'returns nil' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        expect(ad_syncer.fetch).to be_nil
      end
    end
  end

  describe '#synced?' do
    before do
      ad.platform_settings["google"] = { "ad_id" => "12345" }
      ad.save!
    end

    it 'returns true when values match' do
      ad_response = mock_search_response_with_ad_group_ad(
        ad_id: 12345,
        ad_group_id: 999,
        customer_id: 1234567890,
        status: :PAUSED,
        final_urls: ["https://test-site.launch10.ai"],
        path1: "Shop",
        path2: "Now"
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(ad_response)

      expect(ad_syncer.synced?).to be true
    end

    it 'returns false when status does not match' do
      ad.update!(status: "active")
      ad_response = mock_search_response_with_ad_group_ad(
        ad_id: 12345,
        ad_group_id: 999,
        customer_id: 1234567890,
        status: :PAUSED,
        final_urls: ["https://test-site.launch10.ai"],
        path1: "Shop",
        path2: "Now"
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(ad_response)

      expect(ad_syncer.synced?).to be false
    end
  end

  describe '#sync' do
    let(:mock_create_resource) { double("CreateResource") }

    before do
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    context 'when already synced' do
      before do
        ad.platform_settings["google"] = { "ad_id" => "12345" }
        ad.save!
      end

      it 'returns sync_result without making API calls' do
        ad_response = mock_search_response_with_ad_group_ad(
          ad_id: 12345,
          ad_group_id: 999,
          customer_id: 1234567890,
          status: :PAUSED,
          final_urls: ["https://test-site.launch10.ai"],
          path1: "Shop",
          path2: "Now"
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_response)

        expect(@mock_ad_group_ad_service).not_to receive(:mutate_ad_group_ads)
        result = ad_syncer.sync
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.synced?).to be true
      end
    end

    context 'when remote ad does not exist' do
      before do
        ad.platform_settings["google"] = {}
        ad.save!
      end

      it 'creates a new ad with headlines and descriptions' do
        created_ad_response = mock_search_response_with_ad_group_ad(
          ad_id: 12345,
          ad_group_id: 999,
          customer_id: 1234567890,
          status: :PAUSED,
          final_urls: ["https://test-site.launch10.ai"],
          path1: "Shop",
          path2: "Now"
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response, created_ad_response)

        mock_aga = mock_ad_group_ad_resource
        mock_ad_obj = mock_ad_resource
        mock_rsa = mock_responsive_search_ad_info_resource

        expect(mock_aga).to receive(:ad_group=).with("customers/1234567890/adGroups/999")
        expect(mock_aga).to receive(:status=).with(:PAUSED)
        expect(mock_aga).to receive(:ad=).with(mock_ad_obj)

        expect(mock_rsa).to receive(:path1=).with("Shop")
        expect(mock_rsa).to receive(:path2=).with("Now")

        allow(@mock_resource).to receive(:ad).and_yield(mock_ad_obj).and_return(mock_ad_obj)
        allow(@mock_resource).to receive(:responsive_search_ad_info).and_yield(mock_rsa).and_return(mock_rsa)
        allow(@mock_resource).to receive(:ad_text_asset).and_return(mock_ad_text_asset_resource)
        allow(mock_create_resource).to receive(:ad_group_ad).and_yield(mock_aga)

        mutate_response = mock_mutate_ad_group_ad_response(ad_id: 12345, ad_group_id: 999, customer_id: 1234567890)
        allow(@mock_ad_group_ad_service).to receive(:mutate_ad_group_ads)
          .and_return(mutate_response)

        result = ad_syncer.sync
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.created?).to be true
        expect(result.resource_name).to eq(12345)
        expect(result.synced?).to be true
        expect(ad_syncer.record.google_ad_id).to eq(12345)
      end

      it 'returns error result when API call fails' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        mock_aga = mock_ad_group_ad_resource
        mock_ad_obj = mock_ad_resource
        mock_rsa = mock_responsive_search_ad_info_resource
        allow(@mock_resource).to receive(:ad).and_yield(mock_ad_obj).and_return(mock_ad_obj)
        allow(@mock_resource).to receive(:responsive_search_ad_info).and_yield(mock_rsa).and_return(mock_rsa)
        allow(@mock_resource).to receive(:ad_text_asset).and_return(mock_ad_text_asset_resource)
        allow(mock_create_resource).to receive(:ad_group_ad).and_yield(mock_aga)

        allow(@mock_ad_group_ad_service).to receive(:mutate_ad_group_ads)
          .and_raise(mock_google_ads_error(message: "Ad creation failed"))

        result = ad_syncer.sync
        expect(result.error?).to be true
      end
    end

    context 'when remote ad exists but status needs update' do
      before do
        ad.platform_settings["google"] = { "ad_id" => "12345" }
        ad.status = "active"
        ad.save!
      end

      it 'updates the ad status' do
        mismatched_response = mock_search_response_with_ad_group_ad(
          ad_id: 12345,
          ad_group_id: 999,
          customer_id: 1234567890,
          status: :PAUSED,
          final_urls: ["https://test-site.launch10.ai"],
          path1: "Shop",
          path2: "Now"
        )
        updated_response = mock_search_response_with_ad_group_ad(
          ad_id: 12345,
          ad_group_id: 999,
          customer_id: 1234567890,
          status: :ENABLED,
          final_urls: ["https://test-site.launch10.ai"],
          path1: "Shop",
          path2: "Now"
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mismatched_response, updated_response)

        mock_aga = mock_ad_group_ad_resource
        expect(mock_aga).to receive(:status=).with(:ENABLED)

        allow(@mock_update_resource).to receive(:ad_group_ad).and_yield(mock_aga)

        mutate_response = mock_mutate_ad_group_ad_response(ad_id: 12345, ad_group_id: 999, customer_id: 1234567890)
        allow(@mock_ad_group_ad_service).to receive(:mutate_ad_group_ads)
          .and_return(mutate_response)

        result = ad_syncer.sync
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.updated?).to be true
        expect(result.synced?).to be true
      end
    end
  end

  describe '#delete' do
    context 'when remote ad does not exist' do
      before do
        ad.platform_settings["google"].delete("ad_id")
        ad.save!
      end

      it 'returns not_found result' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        result = ad_syncer.delete
        expect(result.not_found?).to be true
        expect(result.resource_type).to eq(:ad_group_ad)
      end
    end

    context 'when remote ad exists' do
      before do
        ad.platform_settings["google"] = { "ad_id" => "12345" }
        ad.save!
      end

      it 'deletes the ad and returns deleted result' do
        ad_response = mock_search_response_with_ad_group_ad(
          ad_id: 12345,
          ad_group_id: 999,
          customer_id: 1234567890,
          status: :PAUSED,
          final_urls: ["https://test-site.launch10.ai"],
          path1: "Shop",
          path2: "Now"
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_response)

        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:ad_group_ad)
          .with("customers/1234567890/adGroupAds/999~12345")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_ad_group_ad_response(ad_id: 12345, ad_group_id: 999, customer_id: 1234567890)
        allow(@mock_ad_group_ad_service).to receive(:mutate_ad_group_ads)
          .and_return(mutate_response)

        result = ad_syncer.delete
        expect(result.deleted?).to be true
        expect(result.resource_type).to eq(:ad_group_ad)
        expect(ad_syncer.record.google_ad_id).to be_nil
      end

      it 'persists the nil google_ad_id to the database' do
        ad_response = mock_search_response_with_ad_group_ad(
          ad_id: 12345,
          ad_group_id: 999,
          customer_id: 1234567890,
          status: :PAUSED,
          final_urls: ["https://test-site.launch10.ai"],
          path1: "Shop",
          path2: "Now"
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_response)

        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:ad_group_ad)
          .with("customers/1234567890/adGroupAds/999~12345")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_ad_group_ad_response(ad_id: 12345, ad_group_id: 999, customer_id: 1234567890)
        allow(@mock_ad_group_ad_service).to receive(:mutate_ad_group_ads)
          .and_return(mutate_response)

        ad_syncer.delete

        fresh_ad = ::Ad.find(ad.id)
        expect(fresh_ad.google_ad_id).to be_nil
      end

      it 'returns error result when API call fails' do
        ad_response = mock_search_response_with_ad_group_ad(
          ad_id: 12345,
          ad_group_id: 999,
          customer_id: 1234567890,
          status: :PAUSED,
          final_urls: ["https://test-site.launch10.ai"],
          path1: "Shop",
          path2: "Now"
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_response)

        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:ad_group_ad)
          .with("customers/1234567890/adGroupAds/999~12345")
          .and_return(mock_remove_operation)

        allow(@mock_ad_group_ad_service).to receive(:mutate_ad_group_ads)
          .and_raise(mock_google_ads_error(message: "Ad deletion failed"))

        result = ad_syncer.delete
        expect(result.error?).to be true
      end
    end
  end

  describe 'Ad model delegation' do
    before do
      ad.platform_settings["google"] = { "ad_id" => "12345" }
      ad.save!
    end

    describe '#google_synced?' do
      it 'delegates to the resource synced? method' do
        ad_response = mock_search_response_with_ad_group_ad(
          ad_id: 12345,
          ad_group_id: 999,
          customer_id: 1234567890,
          status: :PAUSED,
          final_urls: ["https://test-site.launch10.ai"],
          path1: "Shop",
          path2: "Now"
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_response)

        expect(ad.google_synced?).to be true
      end
    end

    describe '#google_sync' do
      it 'delegates to the resource sync method' do
        ad_response = mock_search_response_with_ad_group_ad(
          ad_id: 12345,
          ad_group_id: 999,
          customer_id: 1234567890,
          status: :PAUSED,
          final_urls: ["https://test-site.launch10.ai"],
          path1: "Shop",
          path2: "Now"
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(ad_response)

        result = ad.google_sync
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.unchanged?).to be true
      end
    end

    describe '#google_syncer' do
      it 'returns a GoogleAds::Resources::Ad instance' do
        expect(ad.google_syncer).to be_a(GoogleAds::Resources::Ad)
      end
    end
  end

  describe 'google_ad_id persistence after sync' do
    let(:mock_create_resource) { double("CreateResource") }

    before do
      ad.platform_settings["google"] = {}
      ad.save!
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    it 'sets google_ad_id from resource_name after sync' do
      allow(@mock_google_ads_service).to receive(:search)
        .and_return(mock_empty_search_response)

      mock_aga = mock_ad_group_ad_resource
      mock_ad_obj = mock_ad_resource
      mock_rsa = mock_responsive_search_ad_info_resource
      allow(@mock_resource).to receive(:ad).and_yield(mock_ad_obj).and_return(mock_ad_obj)
      allow(@mock_resource).to receive(:responsive_search_ad_info).and_yield(mock_rsa).and_return(mock_rsa)
      allow(@mock_resource).to receive(:ad_text_asset).and_return(mock_ad_text_asset_resource)
      allow(mock_create_resource).to receive(:ad_group_ad).and_yield(mock_aga)

      mutate_response = mock_mutate_ad_group_ad_response(ad_id: 67890, ad_group_id: 999, customer_id: 1234567890)
      allow(@mock_ad_group_ad_service).to receive(:mutate_ad_group_ads)
        .and_return(mutate_response)

      ad.google_sync
      expect(ad.reload.google_ad_id).to eq(67890)
    end
  end
end
