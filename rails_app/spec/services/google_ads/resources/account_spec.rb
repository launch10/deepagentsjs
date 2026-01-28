require 'rails_helper'

RSpec.describe GoogleAds::Resources::Account do
  include GoogleAdsMocks

  let(:account) { create(:account, :with_google_account, name: "Test Account") }
  let(:ads_account) do
    account.ads_accounts.create!(platform: "google").tap do |aa|
      aa.google_descriptive_name = "Test Ads Account"
      aa.google_currency_code = "USD"
      aa.google_time_zone = "America/New_York"
      aa.google_status = "ENABLED"
      aa.google_auto_tagging_enabled = true
      aa.save!
    end
  end
  let(:resource) { described_class.new(ads_account) }

  before do
    mock_google_ads_client
  end

  # ═══════════════════════════════════════════════════════════════
  # FieldMappable DSL
  # ═══════════════════════════════════════════════════════════════

  describe '.field_mappings' do
    it 'registers all expected fields' do
      expect(described_class.field_mappings.keys).to contain_exactly(
        :descriptive_name, :currency_code, :time_zone, :status, :auto_tagging_enabled
      )
    end

    it 'stores correct local extractors' do
      expect(described_class.field_mappings[:descriptive_name][:local]).to eq(:google_descriptive_name)
      expect(described_class.field_mappings[:currency_code][:local]).to eq(:google_currency_code)
      expect(described_class.field_mappings[:time_zone][:local]).to eq(:google_time_zone)
      expect(described_class.field_mappings[:status][:local]).to eq(:google_status)
      expect(described_class.field_mappings[:auto_tagging_enabled][:local]).to eq(:google_auto_tagging_enabled)
    end

    it 'stores correct remote extractors' do
      expect(described_class.field_mappings[:descriptive_name][:remote]).to eq(:descriptive_name)
      expect(described_class.field_mappings[:currency_code][:remote]).to eq(:currency_code)
      expect(described_class.field_mappings[:time_zone][:remote]).to eq(:time_zone)
      expect(described_class.field_mappings[:status][:remote]).to be_a(Proc)
      expect(described_class.field_mappings[:auto_tagging_enabled][:remote]).to eq(:auto_tagging_enabled)
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # #to_google_json
  # ═══════════════════════════════════════════════════════════════

  describe '#to_google_json' do
    it 'returns hash of local field values (excluding read-only status)' do
      result = resource.to_google_json

      # Status is intentionally excluded - it's read-only from Google
      expect(result).to eq(
        descriptive_name: "Test Ads Account",
        currency_code: "USD",
        time_zone: "America/New_York",
        auto_tagging_enabled: true
      )
    end

    it 'excludes status (read-only from Google)' do
      result = resource.to_google_json

      expect(result.keys).not_to include(:status)
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # #from_google_json
  # ═══════════════════════════════════════════════════════════════

  describe '#from_google_json' do
    let(:remote) do
      described_class::RemoteAccount.new(
        id: 123456,
        descriptive_name: "Test Ads Account",
        status: :ENABLED,
        auto_tagging_enabled: true,
        currency_code: "USD",
        time_zone: "America/New_York"
      )
    end

    it 'returns hash of all remote field values in local format' do
      result = resource.from_google_json(remote)

      expect(result).to eq(
        descriptive_name: "Test Ads Account",
        currency_code: "USD",
        time_zone: "America/New_York",
        status: "ENABLED",  # Lambda converts symbol to string (no reverse transform defined)
        auto_tagging_enabled: true
      )
    end

    it 'handles mismatched values' do
      mismatched_remote = described_class::RemoteAccount.new(
        id: 123456,
        descriptive_name: "Different Name",
        status: :PAUSED,
        auto_tagging_enabled: false,
        currency_code: "EUR",
        time_zone: "Europe/London"
      )

      result = resource.from_google_json(mismatched_remote)

      expect(result[:descriptive_name]).to eq("Different Name")
      expect(result[:status]).to eq("PAUSED")
      expect(result[:auto_tagging_enabled]).to eq(false)
      expect(result[:currency_code]).to eq("EUR")
      expect(result[:time_zone]).to eq("Europe/London")
    end

    it 'uses fetch when no remote provided' do
      allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

      # When fetch returns nil, from_google_json returns nil
      expect(resource.from_google_json).to be_nil
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # #compare_fields
  # ═══════════════════════════════════════════════════════════════

  describe '#compare_fields' do
    let(:remote) do
      described_class::RemoteAccount.new(
        id: 123456,
        descriptive_name: "Test Ads Account",
        status: :ENABLED,
        auto_tagging_enabled: true,
        currency_code: "USD",
        time_zone: "America/New_York"
      )
    end

    it 'returns a FieldCompare instance' do
      result = resource.compare_fields(remote)
      expect(result).to be_a(GoogleAds::FieldCompare)
    end

    it 'matches when all fields are equal' do
      result = resource.compare_fields(remote)
      expect(result.match?).to be true
      expect(result.failures).to be_empty
    end

    it 'detects descriptive_name mismatch' do
      remote_mismatch = described_class::RemoteAccount.new(
        id: 123456,
        descriptive_name: "Different Name",
        status: :ENABLED,
        auto_tagging_enabled: true,
        currency_code: "USD",
        time_zone: "America/New_York"
      )

      result = resource.compare_fields(remote_mismatch)
      expect(result.match?).to be false
      expect(result.failures).to include(:descriptive_name)
    end

    it 'detects auto_tagging_enabled mismatch' do
      remote_mismatch = described_class::RemoteAccount.new(
        id: 123456,
        descriptive_name: "Test Ads Account",
        status: :ENABLED,
        auto_tagging_enabled: false,
        currency_code: "USD",
        time_zone: "America/New_York"
      )

      result = resource.compare_fields(remote_mismatch)
      expect(result.match?).to be false
      expect(result.failures).to include(:auto_tagging_enabled)
    end

    it 'provides debugging hash via to_h' do
      remote_mismatch = described_class::RemoteAccount.new(
        id: 123456,
        descriptive_name: "Different Name",
        status: :ENABLED,
        auto_tagging_enabled: true,
        currency_code: "USD",
        time_zone: "America/New_York"
      )

      result = resource.compare_fields(remote_mismatch)
      hash = result.to_h

      expect(hash[:descriptive_name][:local]).to eq("Test Ads Account")
      expect(hash[:descriptive_name][:remote]).to eq("Different Name")
      expect(hash[:descriptive_name][:match]).to be false
    end

    context 'in test mode' do
      before do
        allow(GoogleAds).to receive(:is_test_mode?).and_return(true)
      end

      it 'ignores status comparison' do
        remote_mismatch = described_class::RemoteAccount.new(
          id: 123456,
          descriptive_name: "Test Ads Account",
          status: :SUSPENDED,
          auto_tagging_enabled: true,
          currency_code: "USD",
          time_zone: "America/New_York"
        )

        result = resource.compare_fields(remote_mismatch)
        expect(result.match?).to be true
      end
    end

    context 'not in test mode' do
      before do
        allow(GoogleAds).to receive(:is_test_mode?).and_return(false)
      end

      it 'detects status mismatch' do
        remote_mismatch = described_class::RemoteAccount.new(
          id: 123456,
          descriptive_name: "Test Ads Account",
          status: :SUSPENDED,
          auto_tagging_enabled: true,
          currency_code: "USD",
          time_zone: "America/New_York"
        )

        result = resource.compare_fields(remote_mismatch)
        expect(result.match?).to be false
        expect(result.failures).to include(:status)
      end
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # #fetch
  # ═══════════════════════════════════════════════════════════════

  describe '#fetch' do
    context 'when no customer_id exists' do
      context 'and no matching name in Google' do
        it 'returns nil' do
          allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

          expect(resource.fetch).to be_nil
        end
      end

      context 'and matching name exists in Google (content-based lookup)' do
        it 'returns remote and backfills ID' do
          owner_email = account.owner.email

          # First call: search by owner email (used as descriptive_name at creation)
          name_response = mock_search_response_with_customer_client(
            customer_id: 456789,
            descriptive_name: owner_email
          )
          # Second call: verify customer by ID
          customer_client_response, auto_tagging_response = mock_verify_customer_responses(
            customer_id: 456789,
            descriptive_name: owner_email,
            auto_tagging_enabled: true,
            status: :ENABLED
          )

          allow(@mock_google_ads_service).to receive(:search)
            .and_return(name_response, customer_client_response, auto_tagging_response)

          result = resource.fetch

          expect(result).not_to be_nil
          expect(result.id).to eq(456789)
          expect(ads_account.reload.google_customer_id).to eq("456789")
        end
      end
    end

    context 'when customer_id exists' do
      before do
        ads_account.google_customer_id = "123456"
        ads_account.save!
      end

      it 'returns remote when found by ID' do
        customer_client_response, auto_tagging_response = mock_verify_customer_responses(
          customer_id: 123456,
          descriptive_name: "Test Ads Account",
          auto_tagging_enabled: true,
          status: :ENABLED
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(customer_client_response, auto_tagging_response)

        result = resource.fetch

        expect(result).not_to be_nil
        expect(result.id).to eq(123456)
        expect(result.descriptive_name).to eq("Test Ads Account")
        expect(result.auto_tagging_enabled).to eq(true)
      end

      it 'returns nil when ID exists but not found in Google (stale ID)' do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        expect(resource.fetch).to be_nil
      end
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # #synced?
  # ═══════════════════════════════════════════════════════════════

  describe '#synced?' do
    context 'when no customer_id and no name match' do
      it 'returns false' do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        expect(resource.synced?).to be false
      end
    end

    context 'when customer_id exists' do
      before do
        ads_account.google_customer_id = "123456"
        ads_account.save!
      end

      it 'returns true when remote matches local (all fields)' do
        customer_client_response, auto_tagging_response = mock_verify_customer_responses(
          customer_id: 123456,
          descriptive_name: "Test Ads Account",
          auto_tagging_enabled: true,
          status: :ENABLED
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(customer_client_response, auto_tagging_response)

        expect(resource.synced?).to be true
      end

      it 'returns false when descriptive_name mismatch' do
        customer_client_response, auto_tagging_response = mock_verify_customer_responses(
          customer_id: 123456,
          descriptive_name: "Different Name",
          auto_tagging_enabled: true,
          status: :ENABLED
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(customer_client_response, auto_tagging_response)

        expect(resource.synced?).to be false
      end

      it 'returns false when auto_tagging_enabled mismatch' do
        customer_client_response, auto_tagging_response = mock_verify_customer_responses(
          customer_id: 123456,
          descriptive_name: "Test Ads Account",
          auto_tagging_enabled: false,
          status: :ENABLED
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(customer_client_response, auto_tagging_response)

        expect(resource.synced?).to be false
      end

      it 'returns false when status is CANCELED' do
        customer_client_response, auto_tagging_response = mock_verify_customer_canceled_responses(
          customer_id: 123456,
          descriptive_name: "Test Ads Account"
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(customer_client_response, auto_tagging_response)

        expect(resource.synced?).to be false
      end

      it 'returns false when local has ID but Google does not have customer (stale ID)' do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        expect(resource.synced?).to be false
      end

      it 'makes TWO API calls (customer_client + customer for auto_tagging)' do
        customer_client_response, auto_tagging_response = mock_verify_customer_responses(
          customer_id: 123456,
          descriptive_name: "Test Ads Account",
          auto_tagging_enabled: true,
          status: :ENABLED
        )

        expect(@mock_google_ads_service).to receive(:search).twice
          .and_return(customer_client_response, auto_tagging_response)

        resource.synced?
      end
    end

    context 'content-based matching' do
      it 'returns true when found by owner email with matching fields' do
        owner_email = account.owner.email

        name_response = mock_search_response_with_customer_client(
          customer_id: 456789,
          descriptive_name: owner_email
        )
        customer_client_response, auto_tagging_response = mock_verify_customer_responses(
          customer_id: 456789,
          descriptive_name: "Test Ads Account",
          auto_tagging_enabled: true,
          status: :ENABLED
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(name_response, customer_client_response, auto_tagging_response)

        expect(resource.synced?).to be true
      end
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # #sync
  # ═══════════════════════════════════════════════════════════════

  describe '#sync' do
    context 'when already synced' do
      before do
        ads_account.google_customer_id = "123456"
        ads_account.save!
      end

      it 'returns unchanged SyncResult without making mutate API call' do
        customer_client_response, auto_tagging_response = mock_verify_customer_responses(
          customer_id: 123456,
          descriptive_name: "Test Ads Account",
          auto_tagging_enabled: true,
          status: :ENABLED
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(customer_client_response, auto_tagging_response)

        expect(@mock_customer_service).not_to receive(:create_customer_client)
        expect(@mock_customer_service).not_to receive(:mutate_customer)

        result = resource.sync

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.unchanged?).to be true
        expect(result.synced?).to be true
        expect(result.resource_type).to eq(:customer)
      end
    end

    context 'when no remote exists (create)' do
      it 'creates new customer and returns created SyncResult' do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        mock_customer = mock_customer_resource
        allow(@mock_resource).to receive(:customer).and_yield(mock_customer).and_return(mock_customer)

        create_response = mock_create_customer_client_response(customer_id: "987654")
        allow(@mock_customer_service).to receive(:create_customer_client).and_return(create_response)

        # Mock auto_tagging update
        mock_update_op = double("UpdateOperation")
        allow(@mock_update_resource).to receive(:customer).and_return(mock_update_op)
        mutate_response = mock_mutate_customer_response_auto_tagging(customer_id: "987654")
        allow(@mock_customer_service).to receive(:mutate_customer).and_return(mutate_response)

        result = resource.sync

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.created?).to be true
        expect(result.synced?).to be true
        expect(result.resource_type).to eq(:customer)
        expect(ads_account.reload.google_customer_id).to eq("987654")
      end

      it 'raises ArgumentError when no connected Google account' do
        allow(account).to receive(:has_google_connected_account?).and_return(false)
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        expect { resource.sync }.to raise_error(ArgumentError, /connected Google account/)
      end

      it 'sets test_account flag when in test mode' do
        allow(GoogleAds).to receive(:is_test_mode?).and_return(true)
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        mock_customer = mock_customer_resource
        expect(mock_customer).to receive(:test_account=).with(true)
        allow(@mock_resource).to receive(:customer).and_yield(mock_customer).and_return(mock_customer)

        create_response = mock_create_customer_client_response(customer_id: "987654")
        allow(@mock_customer_service).to receive(:create_customer_client).and_return(create_response)

        mock_update_op = double("UpdateOperation")
        allow(@mock_update_resource).to receive(:customer).and_return(mock_update_op)
        mutate_response = mock_mutate_customer_response_auto_tagging(customer_id: "987654")
        allow(@mock_customer_service).to receive(:mutate_customer).and_return(mutate_response)

        resource.sync
      end
    end

    context 'when remote exists but fields mismatch (update)' do
      before do
        ads_account.google_customer_id = "123456"
        ads_account.google_descriptive_name = "Updated Name"
        ads_account.save!
      end

      it 'updates descriptive_name when mismatched' do
        customer_client_response, auto_tagging_response = mock_verify_customer_responses(
          customer_id: 123456,
          descriptive_name: "Old Name",
          auto_tagging_enabled: true,
          status: :ENABLED
        )

        # sync() calls synced?() which calls fetch() (2 API calls),
        # then if not synced, sync() calls fetch() again (2 more API calls)
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            customer_client_response, auto_tagging_response,  # First fetch (in synced?)
            customer_client_response, auto_tagging_response   # Second fetch (in sync)
          )

        mock_update_op = double("UpdateOperation")
        allow(@mock_update_resource).to receive(:customer).and_yield(mock_customer_resource).and_return(mock_update_op)

        mutate_response = mock_mutate_customer_response(customer_id: "123456")
        allow(@mock_customer_service).to receive(:mutate_customer).and_return(mutate_response)

        result = resource.sync

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.updated?).to be true
      end

      it 'updates auto_tagging_enabled via separate API call when mismatched' do
        ads_account.google_auto_tagging_enabled = true
        ads_account.google_descriptive_name = "Test Ads Account"
        ads_account.save!

        customer_client_response, auto_tagging_response = mock_verify_customer_responses(
          customer_id: 123456,
          descriptive_name: "Test Ads Account",
          auto_tagging_enabled: false,
          status: :ENABLED
        )

        # sync() calls synced?() which calls fetch() (2 API calls),
        # then if not synced, sync() calls fetch() again (2 more API calls)
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            customer_client_response, auto_tagging_response,  # First fetch (in synced?)
            customer_client_response, auto_tagging_response   # Second fetch (in sync)
          )

        mock_update_op = double("UpdateOperation")
        allow(@mock_update_resource).to receive(:customer).and_return(mock_update_op)

        mutate_response = mock_mutate_customer_response_auto_tagging(customer_id: "123456")
        expect(@mock_customer_service).to receive(:mutate_customer).and_return(mutate_response)

        result = resource.sync

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.updated?).to be true
      end
    end

    context 'when API fails' do
      it 'returns error SyncResult on API failure' do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        mock_customer = mock_customer_resource
        allow(@mock_resource).to receive(:customer).and_yield(mock_customer).and_return(mock_customer)

        allow(@mock_customer_service).to receive(:create_customer_client)
          .and_raise(mock_google_ads_error(message: "Account creation failed"))

        result = resource.sync

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.error?).to be true
        expect(result.synced?).to be false
      end
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # #sync_plan
  # ═══════════════════════════════════════════════════════════════

  describe '#sync_plan' do
    context 'when already synced' do
      before do
        ads_account.google_customer_id = "123456"
        ads_account.save!
      end

      it 'returns plan with no changes' do
        customer_client_response, auto_tagging_response = mock_verify_customer_responses(
          customer_id: 123456,
          descriptive_name: "Test Ads Account",
          auto_tagging_enabled: true,
          status: :ENABLED
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(customer_client_response, auto_tagging_response)

        plan = resource.sync_plan

        expect(plan).to be_a(GoogleAds::Sync::Plan)
        expect(plan.any_changes?).to be false
        expect(plan.unchanged.size).to eq(1)
      end
    end

    context 'when no remote exists' do
      it 'returns plan with create operation' do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        plan = resource.sync_plan

        expect(plan).to be_a(GoogleAds::Sync::Plan)
        expect(plan.any_changes?).to be true
        expect(plan.creates.size).to eq(1)
        expect(plan.creates.first[:action]).to eq(:create)
        expect(plan.creates.first[:record]).to eq(ads_account)
      end
    end

    context 'when descriptive_name mismatch' do
      before do
        ads_account.google_customer_id = "123456"
        ads_account.google_descriptive_name = "Updated Name"
        ads_account.save!
      end

      it 'returns plan with update operation' do
        customer_client_response, auto_tagging_response = mock_verify_customer_responses(
          customer_id: 123456,
          descriptive_name: "Old Name",
          auto_tagging_enabled: true,
          status: :ENABLED
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(customer_client_response, auto_tagging_response)

        plan = resource.sync_plan

        expect(plan).to be_a(GoogleAds::Sync::Plan)
        expect(plan.any_changes?).to be true
        expect(plan.updates.size).to eq(1)
        expect(plan.updates.first[:action]).to eq(:update)
      end
    end

    context 'when auto_tagging mismatch' do
      before do
        ads_account.google_customer_id = "123456"
        ads_account.google_auto_tagging_enabled = true
        ads_account.save!
      end

      it 'returns plan with update_auto_tagging operation' do
        customer_client_response, auto_tagging_response = mock_verify_customer_responses(
          customer_id: 123456,
          descriptive_name: "Test Ads Account",
          auto_tagging_enabled: false,
          status: :ENABLED
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(customer_client_response, auto_tagging_response)

        plan = resource.sync_plan

        expect(plan).to be_a(GoogleAds::Sync::Plan)
        expect(plan.any_changes?).to be true

        auto_tagging_op = plan.operations.find { |op| op[:action] == :update_auto_tagging }
        expect(auto_tagging_op).to be_present
      end
    end

    it 'does NOT make mutations (dry-run only)' do
      allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

      expect(@mock_customer_service).not_to receive(:create_customer_client)
      expect(@mock_customer_service).not_to receive(:mutate_customer)

      resource.sync_plan
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # #delete
  # ═══════════════════════════════════════════════════════════════

  describe '#delete' do
    context 'when no customer_id exists' do
      it 'returns not_found SyncResult' do
        result = resource.delete

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.not_found?).to be true
        expect(result.resource_type).to eq(:customer)
      end
    end

    context 'when customer_id exists' do
      before do
        ads_account.google_customer_id = "123456"
        ads_account.save!
      end

      it 'sets status to CANCELED in Google' do
        customer_client_response, auto_tagging_response = mock_verify_customer_responses(
          customer_id: 123456,
          descriptive_name: "Test Ads Account",
          auto_tagging_enabled: true,
          status: :ENABLED
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(customer_client_response, auto_tagging_response)

        mock_update_op = double("UpdateOperation")
        allow(@mock_update_resource).to receive(:customer).and_yield(mock_customer_resource).and_return(mock_update_op)

        mutate_response = mock_mutate_customer_response(customer_id: "123456")
        expect(@mock_customer_service).to receive(:mutate_customer).and_return(mutate_response)

        resource.delete
      end

      it 'clears local google_customer_id and sets status to CANCELED' do
        customer_client_response, auto_tagging_response = mock_verify_customer_responses(
          customer_id: 123456,
          descriptive_name: "Test Ads Account",
          auto_tagging_enabled: true,
          status: :ENABLED
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(customer_client_response, auto_tagging_response)

        mock_update_op = double("UpdateOperation")
        allow(@mock_update_resource).to receive(:customer).and_return(mock_update_op)

        mutate_response = mock_mutate_customer_response(customer_id: "123456")
        allow(@mock_customer_service).to receive(:mutate_customer).and_return(mutate_response)

        result = resource.delete

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.deleted?).to be true
        expect(ads_account.reload.google_customer_id).to be_nil
        expect(ads_account.google_status).to eq("CANCELED")
      end

      it 'returns error when local has ID but Google does not have customer (stale ID)' do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)

        result = resource.delete

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.error?).to be true
      end

      it 'returns error on API failure' do
        customer_client_response, auto_tagging_response = mock_verify_customer_responses(
          customer_id: 123456,
          descriptive_name: "Test Ads Account",
          auto_tagging_enabled: true,
          status: :ENABLED
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(customer_client_response, auto_tagging_response)

        mock_update_op = double("UpdateOperation")
        allow(@mock_update_resource).to receive(:customer).and_return(mock_update_op)

        allow(@mock_customer_service).to receive(:mutate_customer)
          .and_raise(mock_google_ads_error(message: "Account deletion failed"))

        result = resource.delete

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.error?).to be true
      end
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # Model Integration
  # ═══════════════════════════════════════════════════════════════

  describe 'AdsAccount model helper methods' do
    before do
      ads_account.google_customer_id = "123456"
      ads_account.save!
    end

    describe '#google_synced?' do
      it 'delegates to the resource' do
        customer_client_response, auto_tagging_response = mock_verify_customer_responses(
          customer_id: 123456,
          descriptive_name: "Test Ads Account",
          auto_tagging_enabled: true,
          status: :ENABLED
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(customer_client_response, auto_tagging_response)

        expect(ads_account.google_synced?).to be true
      end
    end

    describe '#google_sync' do
      it 'syncs and returns SyncResult' do
        customer_client_response, auto_tagging_response = mock_verify_customer_responses(
          customer_id: 123456,
          descriptive_name: "Test Ads Account",
          auto_tagging_enabled: true,
          status: :ENABLED
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(customer_client_response, auto_tagging_response)

        result = ads_account.google_sync

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.synced?).to be true
      end
    end

    describe '#google_delete' do
      it 'deletes and returns SyncResult' do
        customer_client_response, auto_tagging_response = mock_verify_customer_responses(
          customer_id: 123456,
          descriptive_name: "Test Ads Account",
          auto_tagging_enabled: true,
          status: :ENABLED
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(customer_client_response, auto_tagging_response)

        mock_update_op = double("UpdateOperation")
        allow(@mock_update_resource).to receive(:customer).and_return(mock_update_op)

        mutate_response = mock_mutate_customer_response(customer_id: "123456")
        allow(@mock_customer_service).to receive(:mutate_customer).and_return(mutate_response)

        result = ads_account.google_delete

        expect(result).to be_a(GoogleAds::SyncResult)
        expect(result.deleted?).to be true
      end
    end

    describe '#google_fetch' do
      it 'fetches and returns remote account' do
        customer_client_response, auto_tagging_response = mock_verify_customer_responses(
          customer_id: 123456,
          descriptive_name: "Test Ads Account",
          auto_tagging_enabled: true,
          status: :ENABLED
        )

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(customer_client_response, auto_tagging_response)

        result = ads_account.google_fetch

        expect(result).not_to be_nil
        expect(result.id).to eq(123456)
      end
    end

    describe '#google_syncer' do
      it 'returns resource instance' do
        expect(ads_account.google_syncer.class.name).to eq(described_class.name)
      end
    end
  end
end
