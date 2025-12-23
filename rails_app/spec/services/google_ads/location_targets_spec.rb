require 'rails_helper'

RSpec.describe GoogleAds::LocationTargets do
  include GoogleAdsMocks

  let(:account) { create(:account, :with_google_account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project) }
  let(:campaign) { create(:campaign, account: account, project: project, website: website) }

  let(:syncer) { described_class.new(campaign) }

  before do
    account.create_ads_account!(platform: "google", google_customer_id: "456")
    campaign.update!(platform_settings: { "google" => { "campaign_id" => "789" } })
    mock_google_ads_client
  end

  describe '#sync' do
    context 'when there are active location targets' do
      let!(:location_target) do
        create(:ad_location_target, campaign: campaign,
          location_name: "Los Angeles",
          country_code: "US",
          location_type: "City",
          platform_settings: { "google" => { "criterion_id" => "geoTargetConstants/1013962" } })
      end

      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
        allow(@mock_operation).to receive(:create_resource).and_return(
          double("CreateResource", campaign_criterion: mock_campaign_criterion_resource)
        )
        allow(@mock_resource).to receive(:location_info).and_yield(mock_location_info_resource).and_return(mock_location_info_resource)
        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(
          mock_mutate_campaign_criterion_response(criterion_id: 111, campaign_id: 789, customer_id: 456)
        )
      end

      it 'syncs all active targets' do
        expect(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria)
        result = syncer.sync
        expect(result).to be_a(GoogleAds::Sync::CollectionSyncResult)
        expect(result.success?).to be true
      end
    end

    context 'when there are deleted location targets' do
      let!(:active_target) do
        create(:ad_location_target, campaign: campaign,
          location_name: "Los Angeles",
          country_code: "US",
          location_type: "City",
          platform_settings: { "google" => { "criterion_id" => "geoTargetConstants/1013962" } })
      end

      let!(:deleted_target) do
        target = create(:ad_location_target, campaign: campaign,
          location_name: "United States",
          country_code: "US",
          location_type: "Country",
          platform_settings: {
            "google" => {
              "criterion_id" => "geoTargetConstants/2840",
              "remote_criterion_id" => "222"
            }
          })
        target.destroy
        target
      end

      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(
          mock_search_response_with_campaign_criterion(
            criterion_id: 222,
            campaign_id: 789,
            customer_id: 456,
            location_id: 2840,
            negative: false
          ),
          mock_empty_search_response
        )
        mock_remove_resource = double("RemoveResource")
        allow(mock_remove_resource).to receive(:campaign_criterion).and_return("remove_operation")
        allow(@mock_operation).to receive(:remove_resource).and_return(mock_remove_resource)
        allow(@mock_operation).to receive(:create_resource).and_return(
          double("CreateResource", campaign_criterion: mock_campaign_criterion_resource)
        )
        allow(@mock_resource).to receive(:location_info).and_yield(mock_location_info_resource).and_return(mock_location_info_resource)
        allow(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).and_return(
          mock_mutate_campaign_criterion_response(criterion_id: 111, campaign_id: 789, customer_id: 456)
        )
      end

      it 'deletes soft-deleted targets before syncing active ones' do
        expect(@mock_campaign_criterion_service).to receive(:mutate_campaign_criteria).at_least(:twice)
        result = syncer.sync
        expect(result.success?).to be true
      end

      it 'clears the remote_criterion_id on deleted targets' do
        syncer.sync
        deleted_target.reload
        expect(deleted_target.google_remote_criterion_id).to be_nil
      end

      it 'returns results for both deletions and syncs' do
        result = syncer.sync
        expect(result.deleted.size).to eq(1)
        expect(result.created.size + result.unchanged.size).to be >= 1
      end
    end

    context 'when deleted target does not exist remotely' do
      let!(:deleted_target) do
        target = create(:ad_location_target, campaign: campaign,
          location_name: "United States",
          country_code: "US",
          location_type: "Country",
          platform_settings: {
            "google" => {
              "criterion_id" => "geoTargetConstants/2840",
              "remote_criterion_id" => "222"
            }
          })
        target.destroy
        target
      end

      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
      end

      it 'handles the not found case gracefully' do
        result = syncer.sync
        expect(result.results.first.not_found?).to be true
      end
    end
  end

  describe '#synced?' do
    context 'when all targets are synced and no deleted targets have remote_ids' do
      let!(:location_target) do
        create(:ad_location_target, campaign: campaign,
          location_name: "Los Angeles",
          country_code: "US",
          location_type: "City",
          platform_settings: {
            "google" => {
              "criterion_id" => "geoTargetConstants/1013962",
              "remote_criterion_id" => "111"
            }
          })
      end

      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(
          mock_search_response_with_campaign_criterion(
            criterion_id: 111,
            campaign_id: 789,
            customer_id: 456,
            location_id: 1013962,
            negative: false
          )
        )
      end

      it 'returns true' do
        expect(syncer.synced?).to be true
      end
    end

    context 'when there are deleted targets with remote_ids' do
      let!(:deleted_target) do
        target = create(:ad_location_target, campaign: campaign,
          location_name: "United States",
          country_code: "US",
          location_type: "Country",
          platform_settings: {
            "google" => {
              "criterion_id" => "geoTargetConstants/2840",
              "remote_criterion_id" => "222"
            }
          })
        target.destroy
        target
      end

      it 'returns false' do
        expect(syncer.synced?).to be false
      end
    end

    context 'when active targets are not synced' do
      let!(:location_target) do
        create(:ad_location_target, campaign: campaign,
          location_name: "Los Angeles",
          country_code: "US",
          location_type: "City",
          platform_settings: { "google" => { "criterion_id" => "geoTargetConstants/1013962" } })
      end

      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
      end

      it 'returns false' do
        expect(syncer.synced?).to be false
      end
    end
  end

  describe '#sync_result' do
    let!(:location_target) do
      create(:ad_location_target, campaign: campaign,
        location_name: "Los Angeles",
        country_code: "US",
        location_type: "City",
        platform_settings: {
          "google" => {
            "criterion_id" => "geoTargetConstants/1013962",
            "remote_criterion_id" => "111"
          }
        })
    end

    before do
      allow(@mock_google_ads_service).to receive(:search).and_return(
        mock_search_response_with_campaign_criterion(
          criterion_id: 111,
          campaign_id: 789,
          customer_id: 456,
          location_id: 1013962,
          negative: false
        )
      )
    end

    it 'returns a CollectionSyncResult' do
      expect(syncer.sync_result).to be_a(GoogleAds::Sync::CollectionSyncResult)
    end

    it 'includes results for all active targets' do
      expect(syncer.sync_result.results.size).to eq(1)
    end
  end
end
