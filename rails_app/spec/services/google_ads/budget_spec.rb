require 'rails_helper'

RSpec.describe GoogleAds::Budget do
  include GoogleAdsMocks

  let(:account) { create(:account) }
  let(:campaign) { create(:campaign, account: account) }
  let(:ad_budget) { create(:ad_budget, campaign: campaign, daily_budget_cents: 500) }
  let(:budget_syncer) { described_class.new(ad_budget) }

  before do
    mock_google_ads_client
    allow(campaign).to receive(:google_customer_id).and_return("1234567890")
  end

  describe '#local_resource' do
    it 'returns the ad_budget passed to the syncer' do
      expect(budget_syncer.local_resource).to eq(ad_budget)
    end
  end

  describe '#campaign' do
    it 'returns the campaign from the ad_budget' do
      expect(budget_syncer.campaign).to eq(campaign)
    end
  end

  describe '#fetch_remote' do
    let(:mock_budget_service) { double("CampaignBudgetService") }

    before do
      ad_budget.google_budget_id = 123
      ad_budget.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign_budget: mock_budget_service)
      )
    end

    context 'when budget exists by ID' do
      it 'fetches the remote budget by ID' do
        budget_response = mock_search_response_with_budget(
          budget_id: 123,
          name: ad_budget.google_budget_name,
          amount_micros: 5_000_000
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

        remote = budget_syncer.fetch_remote
        expect(remote.id).to eq(123)
        expect(remote.amount_micros).to eq(5_000_000)
      end
    end

    context 'when budget does not exist by ID but exists by name' do
      before do
        ad_budget.google_budget_id = nil
        ad_budget.save!
      end

      it 'falls back to fetching by name and backfills the ID' do
        budget_response = mock_search_response_with_budget(
          budget_id: 456,
          name: ad_budget.google_budget_name,
          amount_micros: 5_000_000
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(budget_response)

        remote = budget_syncer.fetch_remote
        expect(remote.id).to eq(456)
        expect(budget_syncer.local_resource.google_budget_id).to eq(456)
      end
    end

    context 'when budget does not exist remotely' do
      before do
        ad_budget.google_budget_id = nil
        ad_budget.save!
      end

      it 'returns nil' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        expect(budget_syncer.fetch_remote).to be_nil
      end
    end
  end

  describe '#sync_result' do
    let(:mock_budget_service) { double("CampaignBudgetService") }

    before do
      ad_budget.google_budget_id = 123
      ad_budget.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign_budget: mock_budget_service)
      )
    end

    context 'when remote budget exists and matches local' do
      it 'returns synced result' do
        budget_response = mock_search_response_with_budget(
          budget_id: 123,
          name: ad_budget.google_budget_name,
          amount_micros: 5_000_000
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

        result = budget_syncer.sync_result
        expect(result.synced?).to be true
        expect(result.action).to eq(:unchanged)
        expect(result.resource_type).to eq(:campaign_budget)
      end
    end

    context 'when remote budget exists but does not match local' do
      it 'returns unsynced result with mismatched fields' do
        budget_response = mock_search_response_with_budget(
          budget_id: 123,
          name: ad_budget.google_budget_name,
          amount_micros: 10_000_000
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

        result = budget_syncer.sync_result
        expect(result.synced?).to be false
        expect(result.values_match?).to be false
        expect(result.mismatched_fields.map(&:our_field)).to include(:daily_budget_cents)
      end
    end

    context 'when remote budget does not exist' do
      before do
        ad_budget.google_budget_id = nil
        ad_budget.save!
      end

      it 'returns not_found result' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        result = budget_syncer.sync_result
        expect(result.not_found?).to be true
        expect(result.synced?).to be false
      end
    end
  end

  describe '#synced?' do
    let(:mock_budget_service) { double("CampaignBudgetService") }

    before do
      ad_budget.google_budget_id = 123
      ad_budget.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign_budget: mock_budget_service)
      )
    end

    it 'returns true when values match' do
      budget_response = mock_search_response_with_budget(
        budget_id: 123,
        name: ad_budget.google_budget_name,
        amount_micros: 5_000_000
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

      expect(budget_syncer.synced?).to be true
    end

    it 'returns false when values do not match' do
      budget_response = mock_search_response_with_budget(
        budget_id: 123,
        name: ad_budget.google_budget_name,
        amount_micros: 999_000_000
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

      expect(budget_syncer.synced?).to be false
    end
  end

  describe '#sync' do
    let(:mock_budget_service) { double("CampaignBudgetService") }
    let(:mock_create_resource) { double("CreateResource") }

    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign_budget: mock_budget_service)
      )
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    context 'when already synced' do
      before do
        ad_budget.google_budget_id = 123
        ad_budget.save!
      end

      it 'returns sync_result without making API calls' do
        budget_response = mock_search_response_with_budget(
          budget_id: 123,
          name: ad_budget.google_budget_name,
          amount_micros: 5_000_000
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

        expect(mock_budget_service).not_to receive(:mutate_campaign_budgets)
        result = budget_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end

    context 'when remote budget does not exist' do
      before do
        ad_budget.google_budget_id = nil
        ad_budget.save!
      end

      it 'creates a new budget and verifies sync' do
        created_budget_response = mock_search_response_with_budget(
          budget_id: 789,
          name: ad_budget.google_budget_name,
          amount_micros: 5_000_000
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response, created_budget_response)

        mock_budget = mock_budget_resource
        allow(mock_budget).to receive(:period=)
        allow(mock_create_resource).to receive(:campaign_budget).and_yield(mock_budget)

        mutate_response = mock_mutate_budget_response(budget_id: 789)
        allow(mock_budget_service).to receive(:mutate_campaign_budgets)
          .and_return(mutate_response)

        result = budget_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.created?).to be true
        expect(result.resource_name).to eq("customers/456/campaignBudgets/789")
        expect(result.synced?).to be true
        expect(budget_syncer.local_resource.google_budget_id).to eq(789)
      end

      it 'returns error result when API call fails' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        mock_budget = mock_budget_resource
        allow(mock_budget).to receive(:period=)
        allow(mock_create_resource).to receive(:campaign_budget).and_yield(mock_budget)

        allow(mock_budget_service).to receive(:mutate_campaign_budgets)
          .and_raise(mock_google_ads_error(message: "Budget creation failed"))

        result = budget_syncer.sync
        expect(result.error?).to be true
        expect(result.error?).to be true
      end
    end

    context 'when remote budget exists but needs update' do
      before do
        ad_budget.google_budget_id = 123
        ad_budget.save!
      end

      it 'updates the budget and verifies sync' do
        mismatched_response = mock_search_response_with_budget(
          budget_id: 123,
          name: ad_budget.google_budget_name,
          amount_micros: 999_000_000
        )
        synced_response = mock_search_response_with_budget(
          budget_id: 123,
          name: ad_budget.google_budget_name,
          amount_micros: 5_000_000
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mismatched_response, synced_response)

        mock_budget = mock_budget_resource
        allow(@mock_update_resource).to receive(:campaign_budget)
          .with("customers/456/campaignBudgets/123")
          .and_yield(mock_budget)

        mutate_response = mock_mutate_budget_response(budget_id: 123)
        allow(mock_budget_service).to receive(:mutate_campaign_budgets)
          .and_return(mutate_response)

        result = budget_syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.updated?).to be true
        expect(result.synced?).to be true
      end
    end
  end

  describe 'AdBudget helper methods' do
    let(:mock_budget_service) { double("CampaignBudgetService") }

    before do
      ad_budget.google_budget_id = 123
      ad_budget.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign_budget: mock_budget_service)
      )
    end

    describe '#google_synced?' do
      it 'delegates to the syncer' do
        budget_response = mock_search_response_with_budget(
          budget_id: 123,
          name: ad_budget.google_budget_name,
          amount_micros: 5_000_000
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

        expect(ad_budget.google_synced?).to be true
      end
    end

    describe '#google_sync_result' do
      it 'returns the sync result' do
        budget_response = mock_search_response_with_budget(
          budget_id: 123,
          name: ad_budget.google_budget_name,
          amount_micros: 5_000_000
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

        result = ad_budget.google_sync_result
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end

    describe '#google_sync' do
      it 'syncs the budget' do
        budget_response = mock_search_response_with_budget(
          budget_id: 123,
          name: ad_budget.google_budget_name,
          amount_micros: 5_000_000
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

        result = ad_budget.google_sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.synced?).to be true
      end
    end
  end

  describe 'after_google_sync callback' do
    let(:mock_budget_service) { double("CampaignBudgetService") }
    let(:mock_create_resource) { double("CreateResource") }

    before do
      ad_budget.google_budget_id = nil
      ad_budget.save!
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign_budget: mock_budget_service)
      )
      allow(@mock_operation).to receive(:create_resource).and_return(mock_create_resource)
    end

    it 'sets google_budget_id from resource_name after sync' do
      created_budget_response = mock_search_response_with_budget(
        budget_id: 789,
        name: ad_budget.google_budget_name,
        amount_micros: 5_000_000
      )

      allow(@mock_google_ads_service).to receive(:search)
        .and_return(mock_empty_search_response, created_budget_response)

      mock_budget = mock_budget_resource
      allow(mock_budget).to receive(:period=)
      allow(mock_create_resource).to receive(:campaign_budget).and_yield(mock_budget)

      mutate_response = mock_mutate_budget_response(budget_id: 789)
      allow(mock_budget_service).to receive(:mutate_campaign_budgets)
        .and_return(mutate_response)

      ad_budget.google_sync
      expect(ad_budget.reload.google_budget_id).to eq("789")
    end

    it 'persists the google_budget_id to the database' do
      created_budget_response = mock_search_response_with_budget(
        budget_id: 999,
        name: ad_budget.google_budget_name,
        amount_micros: 5_000_000
      )

      allow(@mock_google_ads_service).to receive(:search)
        .and_return(mock_empty_search_response, created_budget_response)

      mock_budget = mock_budget_resource
      allow(mock_budget).to receive(:period=)
      allow(mock_create_resource).to receive(:campaign_budget).and_yield(mock_budget)

      mutate_response = mock_mutate_budget_response(budget_id: 999)
      allow(mock_budget_service).to receive(:mutate_campaign_budgets)
        .and_return(mutate_response)

      ad_budget.google_sync

      fresh_budget = AdBudget.find(ad_budget.id)
      expect(fresh_budget.google_budget_id).to eq("999")
    end
  end
end
