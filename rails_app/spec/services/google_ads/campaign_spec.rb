require 'rails_helper'

RSpec.describe GoogleAds::Campaign do
  include GoogleAdsMocks

  let(:account) { create(:account) }
  let(:campaign) { create(:campaign, account: account, name: "Test Campaign") }
  let(:campaign_syncer) { described_class.new(campaign) }

  before do
    mock_google_ads_client
    allow(campaign).to receive(:google_customer_id).and_return("1234567890")
  end

  describe '#local_resource' do
    it 'returns the campaign passed to the syncer' do
      expect(campaign_syncer.local_resource).to eq(campaign)
    end
  end

  describe '#sync_result' do
    let(:mock_campaign_service) { double("CampaignService") }

    before do
      campaign.google_campaign_id = 789
      campaign.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign: mock_campaign_service)
      )
    end

    context 'when remote campaign exists and matches local' do
      it 'returns synced result' do
        campaign_response = mock_search_response_with_campaign(
          campaign_id: 789,
          name: campaign.name,
          status: :PAUSED,
          advertising_channel_type: :SEARCH
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(campaign_response)

        result = campaign_syncer.sync_result
        expect(result.synced?).to be true
        expect(result.action).to eq(:unchanged)
        expect(result.resource_type).to eq(:campaign)
      end
    end

    context 'when remote campaign exists but does not match local' do
      it 'returns unsynced result with mismatched fields' do
        campaign_response = mock_search_response_with_campaign(
          campaign_id: 789,
          name: "Different Name",
          status: :PAUSED,
          advertising_channel_type: :SEARCH
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(campaign_response)

        result = campaign_syncer.sync_result
        expect(result.synced?).to be false
        expect(result.values_match?).to be false
        expect(result.mismatched_fields.map(&:our_field)).to include(:name)
      end
    end

    context 'when remote campaign does not exist' do
      before do
        campaign.google_campaign_id = nil
        campaign.save!
      end

      it 'returns not_found result' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        result = campaign_syncer.sync_result
        expect(result.not_found?).to be true
        expect(result.synced?).to be false
      end
    end
  end

  describe '#synced?' do
    let(:mock_campaign_service) { double("CampaignService") }

    before do
      campaign.google_campaign_id = 789
      campaign.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign: mock_campaign_service)
      )
    end

    it 'returns true when values match' do
      campaign_response = mock_search_response_with_campaign(
        campaign_id: 789,
        name: campaign.name,
        status: :PAUSED,
        advertising_channel_type: :SEARCH
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(campaign_response)

      expect(campaign_syncer.synced?).to be true
    end

    it 'returns false when values do not match' do
      campaign_response = mock_search_response_with_campaign(
        campaign_id: 789,
        name: "Completely Different Name",
        status: :PAUSED,
        advertising_channel_type: :SEARCH
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(campaign_response)

      expect(campaign_syncer.synced?).to be false
    end
  end

  describe '#sync' do
    let(:mock_campaign_service) { double("CampaignService") }
    let(:mock_create_resource) { double("CreateResource") }

    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign: mock_campaign_service)
      )
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    context 'when already synced' do
      before do
        campaign.google_campaign_id = 789
        campaign.save!
      end

      it 'returns sync_result without making API calls' do
        campaign_response = mock_search_response_with_campaign(
          campaign_id: 789,
          name: campaign.name,
          status: :PAUSED,
          advertising_channel_type: :SEARCH
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(campaign_response)

        expect(mock_campaign_service).not_to receive(:mutate_campaigns)
        result = campaign_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end

    context 'when remote campaign does not exist' do
      let(:ad_budget) { create(:ad_budget, campaign: campaign, daily_budget_cents: 500) }
      let(:start_date) { Date.today }
      let(:end_date) { Date.today + 30.days }
      let(:mock_target_spend) { double("TargetSpend") }

      before do
        campaign.google_campaign_id = nil
        campaign.start_date = start_date
        campaign.end_date = end_date
        campaign.google_advertising_channel_type = "SEARCH"
        campaign.google_status = "PAUSED"
        campaign.google_target_google_search = true
        campaign.google_target_search_network = true
        campaign.google_target_content_network = false
        campaign.save!
        ad_budget.google_budget_id = 123
        ad_budget.save!

        stub_const("Google::Ads::GoogleAds::V22::Common::TargetSpend", Class.new do
          def initialize
          end
        end)
      end

      it 'creates a new campaign with correct attributes' do
        created_campaign_response = mock_search_response_with_campaign(
          campaign_id: 999,
          customer_id: 1234567890,
          name: campaign.name,
          status: :PAUSED,
          advertising_channel_type: :SEARCH
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response, created_campaign_response)

        mock_campaign = mock_campaign_resource
        mock_network_settings = double("NetworkSettings")

        expect(mock_campaign).to receive(:name=).with(campaign.name)
        expect(mock_campaign).to receive(:advertising_channel_type=).with(:SEARCH)
        expect(mock_campaign).to receive(:status=).with(:PAUSED)
        expect(mock_campaign).to receive(:campaign_budget=).with("customers/1234567890/campaignBudgets/123")
        expect(mock_campaign).to receive(:start_date=).with(start_date.strftime("%Y%m%d"))
        expect(mock_campaign).to receive(:end_date=).with(end_date.strftime("%Y%m%d"))
        expect(mock_campaign).to receive(:target_spend=)
        expect(mock_campaign).to receive(:network_settings=).with(mock_network_settings)

        expect(mock_network_settings).to receive(:target_google_search=).with(true)
        expect(mock_network_settings).to receive(:target_search_network=).with(true)
        allow(@mock_resource).to receive(:network_settings).and_yield(mock_network_settings).and_return(mock_network_settings)
        allow(mock_create_resource).to receive(:campaign).and_yield(mock_campaign)

        mutate_response = mock_mutate_campaign_response(campaign_id: 999, customer_id: 1234567890)
        allow(mock_campaign_service).to receive(:mutate_campaigns)
          .and_return(mutate_response)

        result = campaign_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.created?).to be true
        expect(result.resource_name).to eq("customers/1234567890/campaigns/999")
        expect(result.synced?).to be true
        expect(campaign_syncer.local_resource.google_campaign_id).to eq(999)
      end

      it 'returns error result when API call fails' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        mock_campaign = mock_campaign_resource
        allow(@mock_resource).to receive(:network_settings).and_yield(double("NetworkSettings").as_null_object)
        allow(mock_create_resource).to receive(:campaign).and_yield(mock_campaign)

        allow(mock_campaign_service).to receive(:mutate_campaigns)
          .and_raise(mock_google_ads_error(message: "Campaign creation failed"))

        result = campaign_syncer.sync
        expect(result.error?).to be true
      end
    end

    context 'when remote campaign exists but needs update' do
      before do
        campaign.google_campaign_id = 789
        campaign.google_status = "PAUSED"
        campaign.google_advertising_channel_type = "SEARCH"
        campaign.save!
      end

      it 'updates only the mismatched fields' do
        mismatched_response = mock_search_response_with_campaign(
          campaign_id: 789,
          customer_id: 1234567890,
          name: "Old Name",
          status: :PAUSED,
          advertising_channel_type: :SEARCH
        )
        synced_response = mock_search_response_with_campaign(
          campaign_id: 789,
          customer_id: 1234567890,
          name: campaign.name,
          status: :PAUSED,
          advertising_channel_type: :SEARCH
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mismatched_response, synced_response)

        mock_campaign = mock_campaign_resource
        expect(mock_campaign).to receive(:name=).with(campaign.name)
        expect(mock_campaign).not_to receive(:status=)
        expect(mock_campaign).not_to receive(:advertising_channel_type=)

        allow(@mock_update_resource).to receive(:campaign)
          .with("customers/1234567890/campaigns/789")
          .and_yield(mock_campaign)

        mutate_response = mock_mutate_campaign_response(campaign_id: 789, customer_id: 1234567890)
        allow(mock_campaign_service).to receive(:mutate_campaigns)
          .and_return(mutate_response)

        result = campaign_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.updated?).to be true
        expect(result.synced?).to be true
      end
    end
  end

  describe '#delete' do
    let(:mock_campaign_service) { double("CampaignService") }

    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign: mock_campaign_service)
      )
    end

    context 'when remote campaign does not exist' do
      before do
        campaign.google_campaign_id = nil
        campaign.save!
      end

      it 'returns not_found result' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        result = campaign_syncer.delete
        expect(result.not_found?).to be true
        expect(result.resource_type).to eq(:campaign)
      end
    end

    context 'when remote campaign exists' do
      before do
        campaign.google_campaign_id = 789
        campaign.save!
      end

      it 'deletes the campaign and returns deleted result' do
        campaign_response = mock_search_response_with_campaign(
          campaign_id: 789,
          customer_id: 1234567890,
          name: campaign.name,
          status: :PAUSED,
          advertising_channel_type: :SEARCH
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(campaign_response)

        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign)
          .with("customers/1234567890/campaigns/789")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_campaign_response(campaign_id: 789, customer_id: 1234567890)
        allow(mock_campaign_service).to receive(:mutate_campaigns)
          .and_return(mutate_response)

        result = campaign_syncer.delete
        expect(result.deleted?).to be true
        expect(result.resource_type).to eq(:campaign)
        expect(campaign_syncer.local_resource.google_campaign_id).to be_nil
      end

      it 'persists the nil google_campaign_id to the database' do
        campaign_response = mock_search_response_with_campaign(
          campaign_id: 789,
          customer_id: 1234567890,
          name: campaign.name,
          status: :PAUSED,
          advertising_channel_type: :SEARCH
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(campaign_response)

        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign)
          .with("customers/1234567890/campaigns/789")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_campaign_response(campaign_id: 789, customer_id: 1234567890)
        allow(mock_campaign_service).to receive(:mutate_campaigns)
          .and_return(mutate_response)

        campaign_syncer.delete

        fresh_campaign = ::Campaign.find(campaign.id)
        expect(fresh_campaign.google_campaign_id).to be_nil
      end

      it 'returns error result when API call fails' do
        campaign_response = mock_search_response_with_campaign(
          campaign_id: 789,
          customer_id: 1234567890,
          name: campaign.name,
          status: :PAUSED,
          advertising_channel_type: :SEARCH
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(campaign_response)

        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign)
          .with("customers/1234567890/campaigns/789")
          .and_return(mock_remove_operation)

        allow(mock_campaign_service).to receive(:mutate_campaigns)
          .and_raise(mock_google_ads_error(message: "Campaign deletion failed"))

        result = campaign_syncer.delete
        expect(result.error?).to be true
      end
    end
  end

  describe 'Campaign model helper methods' do
    let(:mock_campaign_service) { double("CampaignService") }

    before do
      campaign.google_campaign_id = 789
      campaign.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign: mock_campaign_service)
      )
    end

    describe '#google_synced?' do
      it 'delegates to the syncer' do
        campaign_response = mock_search_response_with_campaign(
          campaign_id: 789,
          name: campaign.name,
          status: :PAUSED,
          advertising_channel_type: :SEARCH
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(campaign_response)

        expect(campaign.google_synced?).to be true
      end
    end

    describe '#google_sync_result' do
      it 'returns the sync result' do
        campaign_response = mock_search_response_with_campaign(
          campaign_id: 789,
          name: campaign.name,
          status: :PAUSED,
          advertising_channel_type: :SEARCH
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(campaign_response)

        result = campaign.google_sync_result
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end

    describe '#google_sync' do
      it 'syncs the campaign' do
        campaign_response = mock_search_response_with_campaign(
          campaign_id: 789,
          name: campaign.name,
          status: :PAUSED,
          advertising_channel_type: :SEARCH
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(campaign_response)

        result = campaign.google_sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end
  end
end
