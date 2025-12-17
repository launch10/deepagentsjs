require "rails_helper"

RSpec.describe GoogleAds::AccountManager do
  let(:account) { create(:account, name: "Test Account", google_customer_id: nil) }

  before { mock_google_ads_client }

  describe "#create_client_account" do
    context "when account has no existing google_customer_id" do
      before do
        allow(@mock_resource).to receive(:customer).and_yield(mock_customer_resource).and_return(mock_customer_resource)
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
        allow(@mock_customer_service).to receive(:create_customer_client)
          .and_return(mock_create_customer_client_response(customer_id: "9876543210"))
        allow(@mock_update_resource).to receive(:customer).and_yield(double.as_null_object).and_return(mock_auto_tagging_operation)
        allow(@mock_customer_service).to receive(:mutate_customer).and_return(mock_mutate_customer_response_auto_tagging)
      end

      it "creates a new customer client" do
        expect(@mock_customer_service).to receive(:create_customer_client).with(
          customer_id: "1234567890",
          customer_client: anything
        )
        described_class.create_client_account(account)
      end

      it "updates the account with google_customer_id" do
        described_class.create_client_account(account)
        expect(account.reload.google_customer_id).to eq("9876543210")
      end

      it "enables auto-tagging after creation" do
        expect(@mock_customer_service).to receive(:mutate_customer).at_least(:once)
        described_class.create_client_account(account)
      end

      it "verifies the customer after creation" do
        expect(@mock_google_ads_service).to receive(:search).at_least(:twice)
        described_class.create_client_account(account)
      end

      it "returns the response" do
        result = described_class.create_client_account(account)
        expect(result.resource_name).to eq("customers/9876543210")
      end
    end

    context "when account already exists by name in Google Ads" do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_search_response_with_customer_client(customer_id: 123, descriptive_name: "Test Account"))
        allow(@mock_update_resource).to receive(:customer).and_yield(double.as_null_object).and_return(mock_auto_tagging_operation)
        allow(@mock_customer_service).to receive(:mutate_customer).and_return(mock_mutate_customer_response_auto_tagging)
      end

      it "does not create a new customer" do
        expect(@mock_customer_service).not_to receive(:create_customer_client)
        described_class.create_client_account(account)
      end

      it "returns existing customer_id" do
        result = described_class.create_client_account(account)
        expect(result).to eq(123)
      end

      it "updates the account with the found google_customer_id" do
        described_class.create_client_account(account)
        expect(account.reload.google_customer_id).to eq("123")
      end

      it "ensures auto-tagging is enabled on existing account" do
        expect(@mock_customer_service).to receive(:mutate_customer).at_least(:once)
        described_class.create_client_account(account)
      end
    end

    context "when account has existing valid google_customer_id" do
      let(:account) { create(:account, name: "Test Account", google_customer_id: "123456") }

      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_search_response_with_customer(customer_id: 123456, auto_tagging_enabled: true))
      end

      it "skips creation and returns existing id" do
        expect(@mock_customer_service).not_to receive(:create_customer_client)
        result = described_class.create_client_account(account)
        expect(result).to eq("123456")
      end

      it "does not update the account" do
        expect(account).not_to receive(:update!)
        described_class.create_client_account(account)
      end
    end

    context "when account has existing google_customer_id but auto-tagging is disabled" do
      let(:account) { create(:account, name: "Test Account", google_customer_id: "123456") }

      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_search_response_with_customer(customer_id: 123456, auto_tagging_enabled: false))
        allow(@mock_update_resource).to receive(:customer).and_yield(double.as_null_object).and_return(mock_auto_tagging_operation)
        allow(@mock_customer_service).to receive(:mutate_customer).and_return(mock_mutate_customer_response_auto_tagging)
      end

      it "enables auto-tagging" do
        expect(@mock_customer_service).to receive(:mutate_customer)
        described_class.create_client_account(account)
      end
    end

    context "when account has canceled google_customer_id" do
      let(:account) { create(:account, name: "Test Account", google_customer_id: "123456") }

      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            mock_search_response_with_canceled_customer(customer_id: 123456),
            mock_empty_search_response,
            mock_search_response_with_customer(customer_id: 9999)
          )
        allow(@mock_resource).to receive(:customer).and_yield(mock_customer_resource).and_return(mock_customer_resource)
        allow(@mock_customer_service).to receive(:create_customer_client)
          .and_return(mock_create_customer_client_response(customer_id: "9999"))
        allow(@mock_update_resource).to receive(:customer).and_yield(double.as_null_object).and_return(mock_auto_tagging_operation)
        allow(@mock_customer_service).to receive(:mutate_customer).and_return(mock_mutate_customer_response_auto_tagging)
      end

      it "creates a new account" do
        expect(@mock_customer_service).to receive(:create_customer_client)
        described_class.create_client_account(account)
      end

      it "updates the account with new google_customer_id" do
        described_class.create_client_account(account)
        expect(account.reload.google_customer_id).to eq("9999")
      end
    end

    context "with custom timezone" do
      before do
        allow(@mock_resource).to receive(:customer).and_yield(mock_customer_resource).and_return(mock_customer_resource)
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
        allow(@mock_customer_service).to receive(:create_customer_client)
          .and_return(mock_create_customer_client_response(customer_id: "9876543210"))
        allow(@mock_update_resource).to receive(:customer).and_yield(double.as_null_object).and_return(mock_auto_tagging_operation)
        allow(@mock_customer_service).to receive(:mutate_customer).and_return(mock_mutate_customer_response_auto_tagging)
      end

      it "uses the provided timezone" do
        customer_resource = mock_customer_resource
        allow(@mock_resource).to receive(:customer).and_yield(customer_resource).and_return(customer_resource)

        expect(customer_resource).to receive(:time_zone=).with("America/Los_Angeles")
        described_class.create_client_account(account, timezone: "America/Los_Angeles")
      end
    end

    context "when API returns an error" do
      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
        allow(@mock_resource).to receive(:customer).and_yield(mock_customer_resource).and_return(mock_customer_resource)
        allow(@mock_customer_service).to receive(:create_customer_client).and_raise(mock_permission_denied_error)
      end

      it "raises GoogleAdsError" do
        expect { described_class.create_client_account(account) }
          .to raise_error(Google::Ads::GoogleAds::Errors::GoogleAdsError)
      end
    end
  end

  describe "#cancel_client_account" do
    context "when account has google_customer_id" do
      let(:account) { create(:account, name: "Test Account", google_customer_id: "123456") }

      before do
        allow(@mock_update_resource).to receive(:customer).and_yield(double.as_null_object).and_return(mock_customer_operation)
        allow(@mock_customer_service).to receive(:mutate_customer).and_return(mock_mutate_customer_response)
      end

      it "cancels the customer" do
        expect(@mock_customer_service).to receive(:mutate_customer).with(
          customer_id: "123456",
          operation: anything
        )
        described_class.cancel_client_account(account)
      end

      it "clears google_customer_id" do
        described_class.cancel_client_account(account)
        expect(account.reload.google_customer_id).to be_nil
      end
    end

    context "when account has no google_customer_id but exists by name" do
      let(:account) { create(:account, name: "Test Account", google_customer_id: nil) }

      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_search_response_with_customer_client(customer_id: 789, descriptive_name: "Test Account"))
        allow(@mock_update_resource).to receive(:customer).and_yield(double.as_null_object).and_return(mock_customer_operation)
        allow(@mock_customer_service).to receive(:mutate_customer).and_return(mock_mutate_customer_response)
      end

      it "finds and cancels the customer by name" do
        expect(@mock_customer_service).to receive(:mutate_customer).with(
          customer_id: "789",
          operation: anything
        )
        described_class.cancel_client_account(account)
      end
    end

    context "when account has no google_customer_id and not found by name" do
      let(:account) { create(:account, name: "Test Account", google_customer_id: nil) }

      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
      end

      it "raises ArgumentError" do
        expect { described_class.cancel_client_account(account) }
          .to raise_error(ArgumentError, /No Google Ads account found/)
      end
    end

    context "when API returns an error" do
      let(:account) { create(:account, name: "Test Account", google_customer_id: "123456") }

      before do
        allow(@mock_update_resource).to receive(:customer).and_yield(double.as_null_object).and_return(mock_customer_operation)
        allow(@mock_customer_service).to receive(:mutate_customer).and_raise(mock_customer_not_enabled_error)
      end

      it "raises GoogleAdsError" do
        expect { described_class.cancel_client_account(account) }
          .to raise_error(Google::Ads::GoogleAds::Errors::GoogleAdsError)
      end
    end
  end

  describe "#verify_customer" do
    let(:manager) { described_class.new }

    context "when customer exists" do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_search_response_with_customer(
            customer_id: 123,
            descriptive_name: "Test Client",
            auto_tagging_enabled: true,
            status: :ENABLED,
            time_zone: "America/New_York",
            currency_code: "USD"
          ))
      end

      it "returns customer details hash" do
        result = manager.verify_customer("123")
        expect(result).to include(
          id: 123,
          descriptive_name: "Test Client",
          auto_tagging_enabled: true,
          status: :ENABLED,
          time_zone: "America/New_York",
          currency_code: "USD"
        )
      end
    end

    context "when customer does not exist" do
      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
      end

      it "returns nil" do
        result = manager.verify_customer("999")
        expect(result).to be_nil
      end
    end
  end

  describe "#enable_auto_tagging" do
    let(:manager) { described_class.new }

    before do
      allow(@mock_update_resource).to receive(:customer).and_yield(double.as_null_object).and_return(mock_auto_tagging_operation)
      allow(@mock_customer_service).to receive(:mutate_customer).and_return(mock_mutate_customer_response_auto_tagging)
    end

    it "calls mutate_customer with auto_tagging_enabled" do
      expect(@mock_customer_service).to receive(:mutate_customer).with(
        customer_id: "123",
        operation: anything
      )
      manager.enable_auto_tagging("123")
    end
  end

  describe "#ensure_auto_tagging_enabled" do
    let(:manager) { described_class.new }

    context "when auto-tagging is already enabled" do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_search_response_with_customer(customer_id: 123, auto_tagging_enabled: true))
      end

      it "does not call mutate_customer" do
        expect(@mock_customer_service).not_to receive(:mutate_customer)
        manager.ensure_auto_tagging_enabled("123")
      end
    end

    context "when auto-tagging is disabled" do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_search_response_with_customer(customer_id: 123, auto_tagging_enabled: false))
        allow(@mock_update_resource).to receive(:customer).and_yield(double.as_null_object).and_return(mock_auto_tagging_operation)
        allow(@mock_customer_service).to receive(:mutate_customer).and_return(mock_mutate_customer_response_auto_tagging)
      end

      it "enables auto-tagging" do
        expect(@mock_customer_service).to receive(:mutate_customer)
        manager.ensure_auto_tagging_enabled("123")
      end
    end
  end

  describe "#find_google_customer_id_by_name" do
    let(:manager) { described_class.new }

    context "when customer exists" do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_search_response_with_customer_client(customer_id: 456, descriptive_name: "Test Client"))
      end

      it "returns the customer id" do
        result = manager.find_google_customer_id_by_name("Test Client")
        expect(result).to eq(456)
      end
    end

    context "when customer does not exist" do
      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
      end

      it "returns nil" do
        result = manager.find_google_customer_id_by_name("Nonexistent")
        expect(result).to be_nil
      end
    end

    context "with special characters in name" do
      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
      end

      it "escapes single quotes" do
        expect(@mock_google_ads_service).to receive(:search).with(
          customer_id: "1234567890",
          query: include("O\\'Reilly")
        )
        manager.find_google_customer_id_by_name("O'Reilly")
      end
    end
  end
end
