require 'rails_helper'

RSpec.describe GoogleAds::Resources::Budget do
  include GoogleAdsMocks

  let(:account) { create(:account) }
  let(:campaign) { create(:campaign, account: account) }
  let(:ad_budget) { create(:ad_budget, campaign: campaign, daily_budget_cents: 500) }
  let(:budget_syncer) { described_class.new(ad_budget) }

  before do
    mock_google_ads_client
    allow(campaign).to receive(:google_customer_id).and_return("1234567890")
  end

  describe '#record' do
    it 'returns the ad_budget passed to the syncer' do
      expect(budget_syncer.record).to eq(ad_budget)
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # FieldMappable DSL
  # ═══════════════════════════════════════════════════════════════

  describe '.field_mappings' do
    it 'registers all expected fields' do
      expect(described_class.field_mappings.keys).to contain_exactly(
        :name, :amount_micros
      )
    end

    it 'has no immutable fields' do
      expect(described_class.immutable_fields).to be_empty
    end

    it 'returns all fields as mutable' do
      expect(described_class.mutable_fields).to eq([:name, :amount_micros])
    end
  end

  describe '#to_google_json' do
    it 'returns hash of local field values in Google format' do
      result = budget_syncer.to_google_json

      expect(result).to eq(
        name: ad_budget.google_budget_name,
        amount_micros: 5_000_000  # 500 cents * 10_000
      )
    end
  end

  describe '#from_google_json' do
    let(:remote) do
      double("RemoteBudget",
        name: "Remote Budget",
        amount_micros: 10_000_000)
    end

    it 'returns hash of remote field values in local format' do
      result = budget_syncer.from_google_json(remote)

      expect(result).to eq(
        name: "Remote Budget",
        amount_micros: 1000  # 10_000_000 / 10_000 = 1000 cents
      )
    end
  end

  describe '#compare_fields' do
    let(:remote) do
      double("RemoteBudget",
        name: ad_budget.google_budget_name,
        amount_micros: 5_000_000)
    end

    it 'returns FieldCompare instance' do
      result = budget_syncer.compare_fields(remote)
      expect(result).to be_a(GoogleAds::FieldCompare)
    end

    it 'matches when all fields are equal' do
      result = budget_syncer.compare_fields(remote)
      expect(result.match?).to be true
    end

    it 'detects name mismatch' do
      mismatched_remote = double("RemoteBudget",
        name: "Different Name",
        amount_micros: 5_000_000)

      result = budget_syncer.compare_fields(mismatched_remote)
      expect(result.match?).to be false
      expect(result.failures).to include(:name)
    end

    it 'detects amount_micros mismatch' do
      mismatched_remote = double("RemoteBudget",
        name: ad_budget.google_budget_name,
        amount_micros: 999_000_000)

      result = budget_syncer.compare_fields(mismatched_remote)
      expect(result.match?).to be false
      expect(result.failures).to include(:amount_micros)
    end
  end

  describe '#fetch' do
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

        remote = budget_syncer.fetch
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

        remote = budget_syncer.fetch
        expect(remote.id).to eq(456)
        expect(budget_syncer.record.google_budget_id).to eq(456)
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

        expect(budget_syncer.fetch).to be_nil
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

    context 'when remote budget does not exist' do
      it 'returns not_found result' do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        result = budget_syncer.sync_result
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.not_found?).to be true
        expect(result.success?).to be false
        expect(result.resource_type).to eq(:campaign_budget)
      end
    end

    context 'when fields match' do
      it 'returns unchanged result' do
        budget_response = mock_search_response_with_budget(
          budget_id: 123,
          name: ad_budget.google_budget_name,
          amount_micros: 5_000_000
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

        result = budget_syncer.sync_result
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.unchanged?).to be true
        expect(result.success?).to be true
        expect(result.resource_name).to eq(123)
      end
    end

    context 'when fields do not match' do
      it 'returns error result with SyncVerificationError' do
        budget_response = mock_search_response_with_budget(
          budget_id: 123,
          name: "Different Budget Name",
          amount_micros: 5_000_000
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

        result = budget_syncer.sync_result
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.error?).to be true
        expect(result.success?).to be false
        expect(result.error).to be_a(GoogleAds::SyncVerificationError)
        expect(result.error.message).to include("name")
      end
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

      it 'returns unchanged result without making API calls' do
        budget_response = mock_search_response_with_budget(
          budget_id: 123,
          name: ad_budget.google_budget_name,
          amount_micros: 5_000_000
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

        expect(mock_budget_service).not_to receive(:mutate_campaign_budgets)
        result = budget_syncer.sync
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.unchanged?).to be true
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
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.created?).to be true
        expect(result.resource_name).to eq(789)
        expect(budget_syncer.record.google_budget_id).to eq(789)
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
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.updated?).to be true
      end
    end
  end

  describe '#delete' do
    let(:mock_budget_service) { double("CampaignBudgetService") }

    before do
      allow(@mock_client).to receive(:service).and_return(
        double("Services",
          customer: @mock_customer_service,
          google_ads: @mock_google_ads_service,
          campaign_budget: mock_budget_service)
      )
    end

    context 'when remote budget does not exist' do
      before do
        ad_budget.google_budget_id = nil
        ad_budget.save!
      end

      it 'returns not_found result' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)

        result = budget_syncer.delete
        expect(result.not_found?).to be true
        expect(result.resource_type).to eq(:campaign_budget)
      end
    end

    context 'when remote budget exists' do
      before do
        ad_budget.google_budget_id = 123
        ad_budget.save!
      end

      it 'deletes the budget and returns deleted result' do
        budget_response = mock_search_response_with_budget(
          budget_id: 123,
          name: ad_budget.google_budget_name,
          amount_micros: 5_000_000
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign_budget)
          .with("customers/456/campaignBudgets/123")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_budget_response(budget_id: 123)
        allow(mock_budget_service).to receive(:mutate_campaign_budgets)
          .and_return(mutate_response)

        result = budget_syncer.delete
        expect(result.deleted?).to be true
        expect(result.resource_type).to eq(:campaign_budget)
        expect(budget_syncer.record.google_budget_id).to be_nil
      end

      it 'persists the nil google_budget_id to the database' do
        budget_response = mock_search_response_with_budget(
          budget_id: 123,
          name: ad_budget.google_budget_name,
          amount_micros: 5_000_000
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign_budget)
          .with("customers/456/campaignBudgets/123")
          .and_return(mock_remove_operation)

        mutate_response = mock_mutate_budget_response(budget_id: 123)
        allow(mock_budget_service).to receive(:mutate_campaign_budgets)
          .and_return(mutate_response)

        budget_syncer.delete

        fresh_budget = AdBudget.find(ad_budget.id)
        expect(fresh_budget.google_budget_id).to be_nil
      end

      it 'returns error result when API call fails' do
        budget_response = mock_search_response_with_budget(
          budget_id: 123,
          name: ad_budget.google_budget_name,
          amount_micros: 5_000_000
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

        mock_remove_operation = double("RemoveOperation")
        allow(@mock_remove_resource).to receive(:campaign_budget)
          .with("customers/456/campaignBudgets/123")
          .and_return(mock_remove_operation)

        allow(mock_budget_service).to receive(:mutate_campaign_budgets)
          .and_raise(mock_google_ads_error(message: "Budget deletion failed"))

        result = budget_syncer.delete
        expect(result.error?).to be true
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

    describe '#google_sync' do
      it 'returns unchanged when already synced' do
        budget_response = mock_search_response_with_budget(
          budget_id: 123,
          name: ad_budget.google_budget_name,
          amount_micros: 5_000_000
        )
        allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

        result = ad_budget.google_sync
        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.unchanged?).to be true
      end
    end
  end

  describe 'save_budget_id after create' do
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

    it 'sets google_budget_id from resource_name after create' do
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
      expect(ad_budget.reload.google_budget_id).to eq(789)
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
      expect(fresh_budget.google_budget_id).to eq(999)
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # Instrumentation
  # ═══════════════════════════════════════════════════════════════

  describe 'instrumentation' do
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

    it 'includes Instrumentable' do
      expect(described_class.ancestors.map(&:name)).to include('GoogleAds::Resources::Instrumentable')
    end

    it 'wraps fetch with instrumentation context' do
      budget_response = mock_search_response_with_budget(
        budget_id: 123,
        name: ad_budget.google_budget_name,
        amount_micros: 5_000_000
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

      expect(GoogleAds::Instrumentation).to receive(:with_context)
        .with(budget: ad_budget)
        .at_least(:once)
        .and_call_original

      budget_syncer.fetch
    end

    it 'tags logs with budget_id and campaign_id' do
      budget_response = mock_search_response_with_budget(
        budget_id: 123,
        name: ad_budget.google_budget_name,
        amount_micros: 5_000_000
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

      # Instrumentation formats tags as "key=value" strings for log aggregator compatibility
      expect(Rails.logger).to receive(:tagged).with(
        "budget_id=#{ad_budget.id}",
        "campaign_id=#{ad_budget.campaign_id}"
      ).at_least(:once).and_yield

      budget_syncer.fetch
    end

    it 'wraps sync with instrumentation context' do
      budget_response = mock_search_response_with_budget(
        budget_id: 123,
        name: ad_budget.google_budget_name,
        amount_micros: 5_000_000
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

      expect(GoogleAds::Instrumentation).to receive(:with_context)
        .with(budget: ad_budget)
        .at_least(:once)
        .and_call_original

      budget_syncer.sync
    end

    it 'wraps sync_result with instrumentation context' do
      budget_response = mock_search_response_with_budget(
        budget_id: 123,
        name: ad_budget.google_budget_name,
        amount_micros: 5_000_000
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

      expect(GoogleAds::Instrumentation).to receive(:with_context)
        .with(budget: ad_budget)
        .at_least(:once)
        .and_call_original

      budget_syncer.sync_result
    end

    it 'wraps sync_plan with instrumentation context' do
      budget_response = mock_search_response_with_budget(
        budget_id: 123,
        name: ad_budget.google_budget_name,
        amount_micros: 5_000_000
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

      expect(GoogleAds::Instrumentation).to receive(:with_context)
        .with(budget: ad_budget)
        .at_least(:once)
        .and_call_original

      budget_syncer.sync_plan
    end

    it 'wraps delete with instrumentation context' do
      budget_response = mock_search_response_with_budget(
        budget_id: 123,
        name: ad_budget.google_budget_name,
        amount_micros: 5_000_000
      )
      allow(@mock_google_ads_service).to receive(:search).and_return(budget_response)

      mock_remove_operation = double("RemoveOperation")
      allow(@mock_remove_resource).to receive(:campaign_budget)
        .with("customers/456/campaignBudgets/123")
        .and_return(mock_remove_operation)

      mutate_response = mock_mutate_budget_response(budget_id: 123)
      allow(mock_budget_service).to receive(:mutate_campaign_budgets)
        .and_return(mutate_response)

      expect(GoogleAds::Instrumentation).to receive(:with_context)
        .with(budget: ad_budget)
        .at_least(:once)
        .and_call_original

      budget_syncer.delete
    end
  end
end
