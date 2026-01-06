require 'rails_helper'

RSpec.describe AccountConcerns::GoogleAdsAccount do
  include GoogleAdsMocks

  let(:account) { create(:account, :with_google_account, name: "Test Account") }

  before { mock_google_ads_client }

  def create_google_ads_account(account, customer_id)
    account.ads_accounts.create!(platform: "google", platform_settings: { "google" => { "customer_id" => customer_id } })
  end

  describe '#google_ads_account' do
    it 'returns nil when no google ads account exists' do
      expect(account.google_ads_account).to be_nil
    end

    it 'returns the google ads account when it exists' do
      ads_account = create_google_ads_account(account, "123456")
      expect(account.google_ads_account).to eq(ads_account)
    end
  end

  describe '#google_customer_id' do
    it 'returns nil when no google ads account exists' do
      expect(account.google_customer_id).to be_nil
    end

    it 'returns the customer_id when it exists' do
      create_google_ads_account(account, "123456")
      expect(account.google_customer_id).to eq("123456")
    end
  end

  describe '#has_google_ads_account?' do
    context 'when google_customer_id is present' do
      before { create_google_ads_account(account, "123456") }

      it 'returns true' do
        expect(account.has_google_ads_account?).to be true
      end
    end

    context 'when google_customer_id is nil and no remote exists' do
      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
      end

      it 'returns false' do
        expect(account.has_google_ads_account?).to be false
      end
    end
  end

  describe '#google_ads_billing_url' do
    context 'when google_customer_id is present' do
      before { create_google_ads_account(account, "123456") }

      it 'returns the billing URL' do
        expect(account.google_ads_billing_url).to eq("https://ads.google.com/aw/billing/setup?ocid=123456")
      end
    end

    context 'when google_customer_id is nil' do
      it 'raises an error' do
        expect { account.google_ads_billing_url }
          .to raise_error("Billing URL not available for accounts without Google customer ID")
      end
    end
  end

  describe '#verify_google_ads_account' do
    context 'when remote customer exists' do
      before do
        create_google_ads_account(account, "123456")
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            mock_search_response_with_customer(customer_id: 123456, auto_tagging_enabled: true),
            mock_search_response_with_customer(customer_id: 123456, auto_tagging_enabled: true)
          )
      end

      it 'returns a SyncResult' do
        result = account.verify_google_ads_account
        expect(result).to be_a(GoogleAds::SyncResult)
      end
    end

    context 'when remote customer does not exist' do
      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
      end

      it 'returns a not_found SyncResult' do
        result = account.verify_google_ads_account
        expect(result.not_found?).to be true
      end
    end
  end

  describe '#create_google_ads_account' do
    let(:customer_resource) { mock_customer_resource }

    context 'when no connected Google account' do
      let(:account) { create(:account, name: "Test Account") }

      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
      end

      it 'raises an error' do
        expect { account.create_google_ads_account }
          .to raise_error(ArgumentError, /Cannot create Google Ads account without a connected Google account/)
      end
    end

    context 'when successful' do
      before do
        allow(@mock_resource).to receive(:customer).and_yield(customer_resource).and_return(customer_resource)
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
        allow(@mock_customer_service).to receive(:create_customer_client)
          .and_return(mock_create_customer_client_response(customer_id: "new_customer_789"))
        allow(@mock_update_resource).to receive(:customer)
          .and_yield(double.as_null_object)
          .and_return(mock_auto_tagging_operation)
        allow(@mock_customer_service).to receive(:mutate_customer)
          .and_return(mock_mutate_customer_response_auto_tagging)
      end

      it 'creates a new Google Ads customer client' do
        expect(@mock_customer_service).to receive(:create_customer_client)
        account.create_google_ads_account
      end

      it 'creates an ads_account with the new customer id' do
        account.create_google_ads_account
        expect(account.reload.google_customer_id).to eq("new_customer_789")
      end

      it 'returns a SyncResult' do
        result = account.create_google_ads_account
        expect(result).to be_a(GoogleAds::SyncResult)
      end

      it 'enables auto-tagging after creation' do
        expect(@mock_customer_service).to receive(:mutate_customer)
        account.create_google_ads_account
      end
    end

    context 'when account already exists in Google Ads by name' do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            mock_search_response_with_customer_client(customer_id: 123, descriptive_name: "Test Account"),
            mock_search_response_with_customer(customer_id: 123, descriptive_name: "Test Account", auto_tagging_enabled: true),
            mock_search_response_with_customer(customer_id: 123, descriptive_name: "Test Account", auto_tagging_enabled: true)
          )
        # Mock update_resource.customer for when sync needs to update
        allow(@mock_update_resource).to receive(:customer)
          .and_yield(double.as_null_object)
          .and_return(mock_auto_tagging_operation)
        allow(@mock_customer_service).to receive(:mutate_customer)
          .and_return(mock_mutate_customer_response_auto_tagging)
      end

      it 'does not create a new customer client' do
        expect(@mock_customer_service).not_to receive(:create_customer_client)
        account.create_google_ads_account
      end

      it 'creates an ads_account with the existing customer id' do
        account.create_google_ads_account
        expect(account.reload.google_customer_id).to eq("123")
      end
    end

    context 'when account has existing valid google_customer_id' do
      before do
        create_google_ads_account(account, "existing_123")
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            mock_search_response_with_customer(customer_id: 123, descriptive_name: "Test Account", auto_tagging_enabled: true),
            mock_search_response_with_customer(customer_id: 123, descriptive_name: "Test Account", auto_tagging_enabled: true)
          )
        # Mock update_resource.customer for when sync needs to update
        allow(@mock_update_resource).to receive(:customer)
          .and_yield(double.as_null_object)
          .and_return(mock_auto_tagging_operation)
        allow(@mock_customer_service).to receive(:mutate_customer)
          .and_return(mock_mutate_customer_response_auto_tagging)
      end

      it 'skips creation' do
        expect(@mock_customer_service).not_to receive(:create_customer_client)
        account.create_google_ads_account
      end
    end

    context 'when account has existing google_customer_id without auto-tagging' do
      before do
        create_google_ads_account(account, "existing_123")
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            mock_search_response_with_customer(customer_id: 123, auto_tagging_enabled: false),
            mock_search_response_with_customer(customer_id: 123, auto_tagging_enabled: false)
          )
        allow(@mock_update_resource).to receive(:customer)
          .and_yield(double.as_null_object)
          .and_return(mock_auto_tagging_operation)
        allow(@mock_customer_service).to receive(:mutate_customer)
          .and_return(mock_mutate_customer_response_auto_tagging)
      end

      it 'enables auto-tagging when not already enabled' do
        expect(@mock_customer_service).to receive(:mutate_customer)
        account.create_google_ads_account
      end
    end

    context 'timezone support' do
      before do
        allow(@mock_resource).to receive(:customer).and_yield(customer_resource).and_return(customer_resource)
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
        allow(@mock_customer_service).to receive(:create_customer_client)
          .and_return(mock_create_customer_client_response(customer_id: "tz_account"))
        allow(@mock_update_resource).to receive(:customer)
          .and_yield(double.as_null_object)
          .and_return(mock_auto_tagging_operation)
        allow(@mock_customer_service).to receive(:mutate_customer)
          .and_return(mock_mutate_customer_response_auto_tagging)
      end

      it 'uses account time_zone when available' do
        tz_account = create(:account, :with_google_account, name: "TZ Test Account", time_zone: "America/Los_Angeles")
        tz_customer_resource = mock_customer_resource
        allow(@mock_resource).to receive(:customer).and_yield(tz_customer_resource).and_return(tz_customer_resource)

        expect(tz_customer_resource).to receive(:time_zone=).with("America/Los_Angeles")
        tz_account.create_google_ads_account
      end

      it 'falls back to default timezone when account has none' do
        no_tz_account = create(:account, :with_google_account, name: "No TZ Account", time_zone: nil)
        no_tz_customer_resource = mock_customer_resource
        allow(@mock_resource).to receive(:customer).and_yield(no_tz_customer_resource).and_return(no_tz_customer_resource)

        expect(no_tz_customer_resource).to receive(:time_zone=).with("America/New_York")
        no_tz_account.create_google_ads_account
      end
    end
  end

  describe '#dangerously_destroy_google_ads_account!' do
    context 'when account has no google_ads_account' do
      it 'returns true without making API calls' do
        expect(@mock_customer_service).not_to receive(:mutate_customer)
        expect(account.dangerously_destroy_google_ads_account!).to be true
      end
    end

    context 'when successful' do
      before do
        create_google_ads_account(account, "123456")
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            mock_search_response_with_customer(customer_id: 123456, auto_tagging_enabled: true),
            mock_search_response_with_customer(customer_id: 123456, auto_tagging_enabled: true)
          )
        allow(@mock_update_resource).to receive(:customer)
          .and_yield(double.as_null_object)
          .and_return(mock_customer_operation)
        allow(@mock_customer_service).to receive(:mutate_customer)
          .and_return(mock_mutate_customer_response)
      end

      it 'cancels the customer in Google Ads' do
        expect(@mock_customer_service).to receive(:mutate_customer).with(
          customer_id: "123456",
          operation: anything
        )
        account.dangerously_destroy_google_ads_account!
      end

      it 'clears the google_customer_id' do
        account.dangerously_destroy_google_ads_account!
        expect(account.reload.google_customer_id).to be_nil
      end

      it 'returns true' do
        expect(account.dangerously_destroy_google_ads_account!).to be true
      end
    end
  end
end
