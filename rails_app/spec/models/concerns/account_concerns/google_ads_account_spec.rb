require 'rails_helper'

RSpec.describe AccountConcerns::GoogleAdsAccount do
  include GoogleAdsMocks

  let(:account) { create(:account, name: "Test Account") }

  before { mock_google_ads_client }

  def create_google_ads_account(account, customer_id)
    account.ads_accounts.create!(platform: "google", platform_settings: { "google" => { "customer_id" => customer_id } })
  end

  describe '#has_google_ads_account?' do
    context 'when google_customer_id is present' do
      before { create_google_ads_account(account, "123456") }

      it 'returns true' do
        expect(account.has_google_ads_account?).to be true
      end
    end

    context 'when google_customer_id is nil but exists in Google Ads' do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_search_response_with_customer_client(customer_id: 789, descriptive_name: "Test Account"))
      end

      it 'returns true' do
        expect(account.has_google_ads_account?).to be true
      end
    end

    context 'when google_customer_id is nil and not found in Google Ads' do
      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
      end

      it 'returns false' do
        expect(account.has_google_ads_account?).to be false
      end
    end
  end

  describe '#find_google_customer_id' do
    context 'when google_customer_id is already set' do
      before { create_google_ads_account(account, "existing_id_123") }

      it 'returns the existing google_customer_id without API call' do
        expect(GoogleAds::AccountManager).not_to receive(:new)
        expect(account.find_google_customer_id).to eq("existing_id_123")
      end
    end

    context 'when google_customer_id is nil' do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_search_response_with_customer_client(customer_id: 456, descriptive_name: "Test Account"))
      end

      it 'queries Google Ads API' do
        expect(@mock_google_ads_service).to receive(:search)
        account.find_google_customer_id
      end

      it 'returns the found customer id' do
        expect(account.find_google_customer_id).to eq(456)
      end
    end

    context 'when google_customer_id is nil and not found in Google Ads' do
      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
      end

      it 'returns nil' do
        expect(account.find_google_customer_id).to be_nil
      end
    end
  end

  describe '#set_google_customer_id' do
    context 'when customer id is found' do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_search_response_with_customer_client(customer_id: 999, descriptive_name: "Test Account"))
      end

      it 'creates an ads_account with the customer id' do
        account.set_google_customer_id
        expect(account.reload.google_customer_id.to_s).to eq("999")
      end
    end

    context 'when customer id already exists on account' do
      before { create_google_ads_account(account, "already_set_456") }

      it 'keeps the existing customer id' do
        account.set_google_customer_id
        expect(account.reload.google_customer_id).to eq("already_set_456")
      end
    end

    context 'when customer id is not found' do
      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
      end

      it 'returns error message' do
        result = account.set_google_customer_id
        expect(result).to eq("Customer id not found")
      end

      it 'does not update the account' do
        account.set_google_customer_id
        expect(account.reload.google_customer_id).to be_nil
      end
    end
  end

  describe '#create_google_ads_account' do
    let(:customer_resource) { mock_customer_resource }
    let(:account) { create(:account, name: "Test Account", google_email_address: "test@example.com") }

    before do
      allow(@mock_resource).to receive(:customer).and_yield(customer_resource).and_return(customer_resource)
      allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
      allow(@mock_update_resource).to receive(:customer)
        .and_yield(double.as_null_object)
        .and_return(mock_auto_tagging_operation)
      allow(@mock_customer_service).to receive(:mutate_customer)
        .and_return(mock_mutate_customer_response_auto_tagging)
    end

    context 'when google_email_address is missing' do
      let(:account) { create(:account, name: "Test Account", google_email_address: nil) }

      it 'raises an error' do
        expect { account.create_google_ads_account }
          .to raise_error(ArgumentError, /Cannot create Google Ads account without google_email_address/)
      end
    end

    context 'when successful' do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            mock_empty_search_response,
            mock_search_response_with_customer(customer_id: 789, auto_tagging_enabled: true),
            mock_search_response_with_customer(customer_id: 789, auto_tagging_enabled: true)
          )
        allow(@mock_customer_service).to receive(:create_customer_client)
          .and_return(mock_create_customer_client_response(customer_id: "new_customer_789"))
      end

      it 'creates a new Google Ads customer client' do
        expect(@mock_customer_service).to receive(:create_customer_client)
        account.create_google_ads_account
      end

      it 'creates an ads_account with the new customer id via AccountManager' do
        account.create_google_ads_account
        expect(account.reload.google_customer_id).to be_present
      end

      it 'returns a truthy response' do
        result = account.create_google_ads_account
        expect(result).to be_truthy
      end
    end

    context 'when account already exists in Google Ads by name' do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            mock_search_response_with_customer_client(customer_id: 123, descriptive_name: "Test Account"),
            mock_search_response_with_customer(customer_id: 123, auto_tagging_enabled: true),
            mock_search_response_with_customer(customer_id: 123, auto_tagging_enabled: true)
          )
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

    context 'when API returns an error' do
      before do
        allow(@mock_customer_service).to receive(:create_customer_client)
          .and_raise(mock_permission_denied_error)
      end

      it 'raises GoogleAdsError' do
        expect { account.create_google_ads_account }
          .to raise_error(Google::Ads::GoogleAds::Errors::GoogleAdsError)
      end

      it 'does not update the account' do
        begin
          account.create_google_ads_account
        rescue Google::Ads::GoogleAds::Errors::GoogleAdsError
        end
        expect(account.reload.google_customer_id).to be_nil
      end
    end

    context 'when account has existing valid google_customer_id' do
      let(:account) { create(:account, name: "Test Account") }

      before do
        create_google_ads_account(account, "existing_123")
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            mock_search_response_with_customer(customer_id: 123, auto_tagging_enabled: true),
            mock_search_response_with_customer(customer_id: 123, auto_tagging_enabled: true)
          )
      end

      it 'skips creation and returns existing id' do
        expect(@mock_customer_service).not_to receive(:create_customer_client)
        account.create_google_ads_account
      end

      it 'does not enable auto-tagging when already enabled' do
        expect(@mock_customer_service).not_to receive(:mutate_customer)
        account.create_google_ads_account
      end
    end

    context 'when account has existing google_customer_id without auto-tagging' do
      let(:account) { create(:account, name: "Test Account") }

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

    context 'when account has canceled google_customer_id (idempotency)' do
      let(:account) { create(:account, name: "Test Account", google_email_address: "canceled@example.com") }

      before do
        create_google_ads_account(account, "canceled_456")
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            mock_search_response_with_customer(customer_id: 456, status: :CANCELED, auto_tagging_enabled: false),
            mock_search_response_with_customer(customer_id: 456, status: :CANCELED, auto_tagging_enabled: false),
            mock_empty_search_response,
            mock_search_response_with_customer(customer_id: 999, auto_tagging_enabled: true),
            mock_search_response_with_customer(customer_id: 999, auto_tagging_enabled: true)
          )
        allow(@mock_resource).to receive(:customer)
          .and_yield(mock_customer_resource)
          .and_return(mock_customer_resource)
        allow(@mock_customer_service).to receive(:create_customer_client)
          .and_return(mock_create_customer_client_response(customer_id: "new_999"))
        allow(@mock_update_resource).to receive(:customer)
          .and_yield(double.as_null_object)
          .and_return(mock_auto_tagging_operation)
        allow(@mock_customer_service).to receive(:mutate_customer)
          .and_return(mock_mutate_customer_response_auto_tagging)
      end

      it 'creates a new account when existing is canceled' do
        expect(@mock_customer_service).to receive(:create_customer_client)
        account.create_google_ads_account
      end

      it 'updates account with new customer id' do
        account.create_google_ads_account
        expect(account.reload.google_customer_id).to be_present
      end
    end

    context 'auto-tagging' do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            mock_empty_search_response,
            mock_search_response_with_customer(customer_id: 9999, auto_tagging_enabled: true),
            mock_search_response_with_customer(customer_id: 9999, auto_tagging_enabled: true)
          )
        allow(@mock_resource).to receive(:customer)
          .and_yield(mock_customer_resource)
          .and_return(mock_customer_resource)
        allow(@mock_customer_service).to receive(:create_customer_client)
          .and_return(mock_create_customer_client_response(customer_id: "9999"))
        allow(@mock_update_resource).to receive(:customer)
          .and_yield(double.as_null_object)
          .and_return(mock_auto_tagging_operation)
        allow(@mock_customer_service).to receive(:mutate_customer)
          .and_return(mock_mutate_customer_response_auto_tagging)
      end

      it 'enables auto-tagging after creation' do
        expect(@mock_customer_service).to receive(:mutate_customer)
        account.create_google_ads_account
      end
    end

    context 'timezone support' do
      it 'uses account time_zone when available' do
        tz_account = create(:account, name: "TZ Test Account", time_zone: "America/Los_Angeles", google_email_address: "tz@example.com")
        tz_customer_resource = mock_customer_resource

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            mock_empty_search_response,
            mock_search_response_with_customer(customer_id: 123, auto_tagging_enabled: true),
            mock_search_response_with_customer(customer_id: 123, auto_tagging_enabled: true)
          )
        allow(@mock_resource).to receive(:customer)
          .and_yield(tz_customer_resource)
          .and_return(tz_customer_resource)
        allow(@mock_customer_service).to receive(:create_customer_client)
          .and_return(mock_create_customer_client_response(customer_id: "tz_account"))
        allow(@mock_update_resource).to receive(:customer)
          .and_yield(double.as_null_object)
          .and_return(mock_auto_tagging_operation)
        allow(@mock_customer_service).to receive(:mutate_customer)
          .and_return(mock_mutate_customer_response_auto_tagging)

        expect(tz_customer_resource).to receive(:time_zone=).with("America/Los_Angeles")
        tz_account.create_google_ads_account
      end

      it 'falls back to default timezone when account has none' do
        no_tz_account = create(:account, name: "No TZ Account", time_zone: nil, google_email_address: "notz@example.com")
        no_tz_customer_resource = mock_customer_resource

        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            mock_empty_search_response,
            mock_search_response_with_customer(customer_id: 456, auto_tagging_enabled: true),
            mock_search_response_with_customer(customer_id: 456, auto_tagging_enabled: true)
          )
        allow(@mock_resource).to receive(:customer)
          .and_yield(no_tz_customer_resource)
          .and_return(no_tz_customer_resource)
        allow(@mock_customer_service).to receive(:create_customer_client)
          .and_return(mock_create_customer_client_response(customer_id: "no_tz_account"))
        allow(@mock_update_resource).to receive(:customer)
          .and_yield(double.as_null_object)
          .and_return(mock_auto_tagging_operation)
        allow(@mock_customer_service).to receive(:mutate_customer)
          .and_return(mock_mutate_customer_response_auto_tagging)

        expect(no_tz_customer_resource).to receive(:time_zone=).with("America/New_York")
        no_tz_account.create_google_ads_account
      end
    end

    context 'verify customer after creation' do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            mock_empty_search_response,
            mock_search_response_with_customer(customer_id: 7777, auto_tagging_enabled: true),
            mock_search_response_with_customer(customer_id: 7777, auto_tagging_enabled: true)
          )
        allow(@mock_resource).to receive(:customer)
          .and_yield(mock_customer_resource)
          .and_return(mock_customer_resource)
        allow(@mock_customer_service).to receive(:create_customer_client)
          .and_return(mock_create_customer_client_response(customer_id: "7777"))
        allow(@mock_update_resource).to receive(:customer)
          .and_yield(double.as_null_object)
          .and_return(mock_auto_tagging_operation)
        allow(@mock_customer_service).to receive(:mutate_customer)
          .and_return(mock_mutate_customer_response_auto_tagging)
      end

      it 'verifies the customer was created successfully' do
        expect(@mock_google_ads_service).to receive(:search).at_least(:twice)
        account.create_google_ads_account
      end
    end
  end

  describe '#dangerously_destroy_google_ads_account!' do
    let(:account) { create(:account, name: "Test Account") }

    before { create_google_ads_account(account, "123456") }

    context 'when successful' do
      before do
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

    context 'when account has no google_customer_id' do
      let!(:account_without_ads) { create(:account, name: "Test Account Without Ads") }

      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
      end

      it 'raises ArgumentError' do
        expect { account_without_ads.dangerously_destroy_google_ads_account! }
          .to raise_error(ArgumentError, /No Google Ads account found/)
      end
    end

    context 'when API returns an error' do
      before do
        allow(@mock_update_resource).to receive(:customer)
          .and_yield(double.as_null_object)
          .and_return(mock_customer_operation)
        allow(@mock_customer_service).to receive(:mutate_customer)
          .and_raise(mock_customer_not_found_error)
      end

      it 'raises GoogleAdsError' do
        expect { account.dangerously_destroy_google_ads_account! }
          .to raise_error(Google::Ads::GoogleAds::Errors::GoogleAdsError)
      end

      it 'does not clear the google_customer_id' do
        begin
          account.dangerously_destroy_google_ads_account!
        rescue Google::Ads::GoogleAds::Errors::GoogleAdsError
        end
        expect(account.reload.google_customer_id).to eq("123456")
      end
    end
  end
end
