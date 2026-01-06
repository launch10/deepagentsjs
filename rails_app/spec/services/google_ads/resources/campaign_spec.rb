require 'rails_helper'

RSpec.describe GoogleAds::Resources::Campaign do
  include GoogleAdsMocks

  let(:account) { create(:account) }
  let(:campaign) { create(:campaign, account: account, name: "Test Campaign") }
  let(:campaign_syncer) { described_class.new(campaign) }

  before do
    mock_google_ads_client
    allow(campaign).to receive(:google_customer_id).and_return("1234567890")
  end

  # ═══════════════════════════════════════════════════════════════
  # INSTRUMENTATION
  # ═══════════════════════════════════════════════════════════════

  describe 'instrumentation' do
    it 'includes Instrumentable' do
      expect(described_class.ancestors).to include(GoogleAds::Resources::Instrumentable)
    end

    it 'provides instrumentation context with campaign' do
      expect(campaign_syncer.instrumentation_context).to eq({ campaign: campaign })
    end

    it 'tags logs with campaign_id, customer_id, and account_id' do
      campaign.google_campaign_id = 789
      campaign.save!

      campaign_response = mock_search_response_with_campaign(
        campaign_id: 789,
        name: campaign.name,
        status: :PAUSED,
        advertising_channel_type: :SEARCH
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(campaign_response)

      # Instrumentation formats tags as "key=value" strings for log aggregator compatibility
      expect(Rails.logger).to receive(:tagged).with(
        "campaign_id=#{campaign.id}",
        "google_customer_id=1234567890",
        "account_id=#{account.id}"
      ).at_least(:once).and_yield

      campaign_syncer.fetch
    end

    describe 'instrumented methods' do
      %i[sync sync_result sync_plan delete fetch].each do |method|
        it "wraps #{method} with instrumentation" do
          expect(GoogleAds::Instrumentation).to receive(:with_context)
            .with(campaign: campaign)
            .at_least(:once)
            .and_call_original

          # Stub the actual API calls
          campaign.google_campaign_id = 789
          campaign.save!

          campaign_response = mock_search_response_with_campaign(
            campaign_id: 789,
            name: campaign.name,
            status: :PAUSED,
            advertising_channel_type: :SEARCH
          )
          allow(@mock_google_ads_service).to receive(:search).and_return(campaign_response)

          # Mock delete operation for the delete test
          if method == :delete
            mock_remove_operation = double("RemoveOperation")
            allow(@mock_remove_resource).to receive(:campaign)
              .with("customers/1234567890/campaigns/789")
              .and_return(mock_remove_operation)

            mock_campaign_service = double("CampaignService")
            allow(@mock_client).to receive(:service).and_return(
              double("Services",
                customer: @mock_customer_service,
                google_ads: @mock_google_ads_service,
                campaign: mock_campaign_service)
            )
            mutate_response = mock_mutate_campaign_response(campaign_id: 789, customer_id: 1234567890)
            allow(mock_campaign_service).to receive(:mutate_campaigns).and_return(mutate_response)
          end

          campaign_syncer.public_send(method)
        end
      end
    end
  end

  describe '#record' do
    it 'returns the campaign passed to the syncer' do
      expect(campaign_syncer.record).to eq(campaign)
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # FieldMappable DSL
  # ═══════════════════════════════════════════════════════════════

  describe '.field_mappings' do
    it 'registers all expected fields' do
      expect(described_class.field_mappings.keys).to contain_exactly(
        :name, :status, :advertising_channel_type, :contains_eu_political_advertising
      )
    end

    it 'marks advertising_channel_type as immutable' do
      expect(described_class.immutable_fields).to eq([:advertising_channel_type])
    end

    it 'returns mutable fields' do
      expect(described_class.mutable_fields).to eq([:name, :status, :contains_eu_political_advertising])
    end
  end

  describe '#to_google_json' do
    before do
      campaign.google_status = "PAUSED"
      campaign.google_advertising_channel_type = "SEARCH"
      campaign.save!
    end

    it 'returns hash of local field values in Google format' do
      result = campaign_syncer.to_google_json

      expect(result).to eq(
        name: "Test Campaign",
        status: :PAUSED,
        advertising_channel_type: :SEARCH,
        contains_eu_political_advertising: :DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
      )
    end
  end

  describe '#from_google_json' do
    let(:remote) do
      double("RemoteCampaign",
        name: "Remote Campaign",
        status: :ENABLED,
        advertising_channel_type: :DISPLAY,
        contains_eu_political_advertising: :DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING)
    end

    it 'returns hash of remote field values in local format' do
      result = campaign_syncer.from_google_json(remote)

      expect(result).to eq(
        name: "Remote Campaign",
        status: "enabled",
        advertising_channel_type: "display",
        contains_eu_political_advertising: false
      )
    end
  end

  describe '#compare_fields' do
    before do
      campaign.google_status = "PAUSED"
      campaign.google_advertising_channel_type = "SEARCH"
      campaign.save!
    end

    let(:remote) do
      double("RemoteCampaign",
        name: "Test Campaign",
        status: :PAUSED,
        advertising_channel_type: :SEARCH,
        contains_eu_political_advertising: :DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING)
    end

    it 'returns FieldCompare instance' do
      result = campaign_syncer.compare_fields(remote)
      expect(result).to be_a(GoogleAds::FieldCompare)
    end

    it 'matches when all fields are equal' do
      result = campaign_syncer.compare_fields(remote)
      expect(result.match?).to be true
    end

    it 'detects name mismatch' do
      mismatched_remote = double("RemoteCampaign",
        name: "Different Name",
        status: :PAUSED,
        advertising_channel_type: :SEARCH)

      result = campaign_syncer.compare_fields(mismatched_remote)
      expect(result.match?).to be false
      expect(result.failures).to include(:name)
    end

    it 'detects status mismatch' do
      mismatched_remote = double("RemoteCampaign",
        name: "Test Campaign",
        status: :ENABLED,
        advertising_channel_type: :SEARCH)

      result = campaign_syncer.compare_fields(mismatched_remote)
      expect(result.match?).to be false
      expect(result.failures).to include(:status)
    end
  end

  describe '#fetch' do
    let(:mock_campaign_service) { double("CampaignService") }

    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign: mock_campaign_service)
      )
    end

    context 'when campaign exists by ID' do
      before do
        campaign.google_campaign_id = 789
        campaign.save!
      end

      it 'fetches the remote campaign by ID' do
        campaign_response = mock_search_response_with_campaign(
          campaign_id: 789,
          name: campaign.name,
          status: :PAUSED,
          advertising_channel_type: :SEARCH
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(campaign_response)

        remote = campaign_syncer.fetch
        expect(remote.id).to eq(789)
        expect(remote.name).to eq(campaign.name)
      end
    end

    context 'when campaign ID is missing but campaign exists by name' do
      before do
        campaign.google_campaign_id = nil
        campaign.save!
      end

      it 'fetches the remote campaign by name and backfills the ID' do
        campaign_response = mock_search_response_with_campaign(
          campaign_id: 789,
          name: campaign.name,
          status: :PAUSED,
          advertising_channel_type: :SEARCH
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(campaign_response)

        remote = campaign_syncer.fetch
        expect(remote.id).to eq(789)
        expect(campaign.reload.google_campaign_id).to eq("789")
      end
    end

    context 'when campaign does not exist remotely by ID or name' do
      before do
        campaign.google_campaign_id = nil
        campaign.save!
      end

      it 'returns nil' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        expect(campaign_syncer.fetch).to be_nil
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

    context 'when remote campaign does not exist' do
      it 'returns not_found result' do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        result = campaign_syncer.sync_result
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.not_found?).to be true
        expect(result.resource_type).to eq(:campaign)
      end
    end

    context 'when remote campaign is REMOVED' do
      it 'returns not_found result' do
        campaign_response = mock_search_response_with_campaign(
          campaign_id: 789,
          name: campaign.name,
          status: :REMOVED,
          advertising_channel_type: :SEARCH
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(campaign_response)

        result = campaign_syncer.sync_result
        expect(result.not_found?).to be true
      end
    end

    context 'when fields match' do
      it 'returns unchanged result' do
        campaign_response = mock_search_response_with_campaign(
          campaign_id: 789,
          name: campaign.name,
          status: :PAUSED,
          advertising_channel_type: :SEARCH
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(campaign_response)

        result = campaign_syncer.sync_result
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.unchanged?).to be true
        expect(result.success?).to be true
        expect(result.resource_name).to eq(789)
      end
    end

    context 'when fields do not match' do
      it 'returns error result with SyncVerificationError' do
        campaign_response = mock_search_response_with_campaign(
          campaign_id: 789,
          name: "Different Name",
          status: :PAUSED,
          advertising_channel_type: :SEARCH
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(campaign_response)

        result = campaign_syncer.sync_result
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.error?).to be true
        expect(result.success?).to be false
        expect(result.error).to be_a(GoogleAds::SyncVerificationError)
        expect(result.error.message).to include("name")
      end
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

      it 'returns unchanged result without making API calls' do
        campaign_response = mock_search_response_with_campaign(
          campaign_id: 789,
          name: campaign.name,
          status: :PAUSED,
          advertising_channel_type: :SEARCH
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(campaign_response)

        expect(mock_campaign_service).not_to receive(:mutate_campaigns)
        result = campaign_syncer.sync
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.unchanged?).to be true
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
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

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
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.created?).to be true
        expect(result.resource_name).to eq(999)
        expect(campaign_syncer.record.google_campaign_id).to eq(999)
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

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mismatched_response)

        mock_campaign = mock_campaign_resource
        expect(mock_campaign).to receive(:name=).with(campaign.name)

        allow(@mock_update_resource).to receive(:campaign)
          .with("customers/1234567890/campaigns/789")
          .and_yield(mock_campaign)

        mutate_response = mock_mutate_campaign_response(campaign_id: 789, customer_id: 1234567890)
        allow(mock_campaign_service).to receive(:mutate_campaigns)
          .and_return(mutate_response)

        result = campaign_syncer.sync
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.updated?).to be true
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

    context 'when campaign ID is not present' do
      before do
        campaign.google_campaign_id = nil
        campaign.save!
      end

      it 'returns not_found result' do
        result = campaign_syncer.delete
        expect(result.not_found?).to be true
        expect(result.resource_type).to eq(:campaign)
      end
    end

    context 'when campaign ID is present' do
      before do
        campaign.google_campaign_id = 789
        campaign.save!
      end

      it 'deletes the campaign and returns deleted result' do
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
        expect(campaign_syncer.record.google_campaign_id).to be_nil
      end

      it 'persists the nil google_campaign_id to the database' do
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

    describe '#google_sync' do
      it 'returns unchanged when already synced' do
        campaign_response = mock_search_response_with_campaign(
          campaign_id: 789,
          name: campaign.name,
          status: :PAUSED,
          advertising_channel_type: :SEARCH
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(campaign_response)

        result = campaign.google_sync
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.unchanged?).to be true
      end
    end
  end

  describe 'save_campaign_id after create' do
    let(:mock_campaign_service) { double("CampaignService") }
    let(:mock_create_resource) { double("CreateResource") }

    before do
      campaign.google_campaign_id = nil
      campaign.google_advertising_channel_type = "SEARCH"
      campaign.google_status = "PAUSED"
      campaign.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign: mock_campaign_service)
      )
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)

      stub_const("Google::Ads::GoogleAds::V22::Common::TargetSpend", Class.new do
        def initialize
        end
      end)
    end

    it 'sets google_campaign_id from resource_name after sync' do
      allow(@mock_google_ads_service).to receive(:search)
        .and_return(mock_empty_search_response)

      mock_campaign = mock_campaign_resource
      mock_network_settings = double("NetworkSettings").as_null_object
      allow(@mock_resource).to receive(:network_settings).and_yield(mock_network_settings).and_return(mock_network_settings)
      allow(mock_create_resource).to receive(:campaign).and_yield(mock_campaign)

      mutate_response = mock_mutate_campaign_response(campaign_id: 99999, customer_id: 1234567890)
      allow(mock_campaign_service).to receive(:mutate_campaigns)
        .and_return(mutate_response)

      campaign.google_sync
      expect(campaign.reload.google_campaign_id).to eq(99999)
    end
  end
end
