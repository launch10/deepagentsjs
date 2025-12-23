require "rails_helper"

RSpec.describe GoogleAds::Account do
  include GoogleAdsMocks

  let(:account) { create(:account, :with_google_account, name: "Test Account") }
  let(:ads_account) { account.ads_accounts.find_or_create_by!(platform: "google") }
  let(:syncer) { described_class.new(ads_account) }

  before { mock_google_ads_client }

  describe "#local_resource" do
    it "returns the ads_account passed to the syncer" do
      expect(syncer.local_resource).to eq(ads_account)
    end
  end

  describe "#account" do
    it "returns the parent account" do
      expect(syncer.account).to eq(account)
    end
  end

  describe "#fetch_remote" do
    context "when customer exists by ID" do
      before do
        ads_account.google_customer_id = "123456"
        ads_account.save!
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            mock_search_response_with_customer(customer_id: 123456, auto_tagging_enabled: true),
            mock_search_response_with_customer(customer_id: 123456, auto_tagging_enabled: true)
          )
      end

      it "fetches the remote customer by ID" do
        remote = syncer.fetch_remote
        expect(remote.id).to eq(123456)
      end
    end

    context "when customer does not exist by ID but exists by name" do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_search_response_with_customer_client(customer_id: 789, descriptive_name: "Test Account"))
          .and_return(
            mock_search_response_with_customer(customer_id: 789, auto_tagging_enabled: true),
            mock_search_response_with_customer(customer_id: 789, auto_tagging_enabled: true)
          )
      end

      it "falls back to fetching by name and backfills the customer_id" do
        remote = syncer.fetch_remote
        expect(remote.id).to eq(789)
        expect(ads_account.google_customer_id).to eq("789")
      end
    end

    context "when customer does not exist remotely" do
      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
      end

      it "returns nil" do
        expect(syncer.fetch_remote).to be_nil
      end
    end
  end

  describe "#sync_result" do
    context "when remote customer exists and matches local" do
      before do
        ads_account.google_customer_id = "123456"
        ads_account.save!
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            mock_search_response_with_customer(
              customer_id: 123456,
              descriptive_name: account.name,
              auto_tagging_enabled: true
            ),
            mock_search_response_with_customer(customer_id: 123456, auto_tagging_enabled: true)
          )
      end

      it "returns synced result" do
        result = syncer.sync_result
        expect(result.resource_type).to eq(:customer)
        expect(result.action).to eq(:unchanged)
      end
    end

    context "when remote customer does not exist" do
      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
      end

      it "returns not_found result" do
        result = syncer.sync_result
        expect(result.not_found?).to be true
      end
    end
  end

  describe "#sync" do
    context "when already synced" do
      before do
        ads_account.google_customer_id = "123456"
        ads_account.save!
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            mock_search_response_with_customer(
              customer_id: 123456,
              descriptive_name: account.name,
              auto_tagging_enabled: true
            ),
            mock_search_response_with_customer(customer_id: 123456, auto_tagging_enabled: true)
          )
      end

      it "returns sync_result without making API calls" do
        expect(@mock_customer_service).not_to receive(:create_customer_client)
        expect(@mock_customer_service).not_to receive(:mutate_customer)
        result = syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
      end
    end

    context "when remote customer does not exist" do
      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
        allow(@mock_resource).to receive(:customer).and_yield(mock_customer_resource).and_return(mock_customer_resource)
        allow(@mock_customer_service).to receive(:create_customer_client)
          .and_return(mock_create_customer_client_response(customer_id: "9876543210"))
        allow(@mock_update_resource).to receive(:customer).and_yield(double.as_null_object).and_return(mock_auto_tagging_operation)
        allow(@mock_customer_service).to receive(:mutate_customer).and_return(mock_mutate_customer_response_auto_tagging)
      end

      it "creates a new customer" do
        expect(@mock_customer_service).to receive(:create_customer_client).with(
          customer_id: "1234567890",
          customer_client: anything
        )
        syncer.sync
      end

      it "sets the google_customer_id on ads_account" do
        syncer.sync
        expect(ads_account.reload.google_customer_id).to eq("9876543210")
      end

      it "enables auto-tagging after creation" do
        expect(@mock_customer_service).to receive(:mutate_customer).at_least(:once)
        syncer.sync
      end

      it "returns a created SyncResult" do
        result = syncer.sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.created?).to be true
      end
    end

    context "when account has no connected Google account" do
      let(:account) { create(:account, name: "Test Account") }

      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
      end

      it "raises ArgumentError" do
        expect { syncer.sync }.to raise_error(ArgumentError, /connected Google account/)
      end
    end

    context "when remote customer exists but auto-tagging is disabled" do
      before do
        ads_account.google_customer_id = "123456"
        ads_account.save!
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            mock_search_response_with_customer(customer_id: 123456, auto_tagging_enabled: false),
            mock_search_response_with_customer(customer_id: 123456, auto_tagging_enabled: false)
          )
        allow(@mock_update_resource).to receive(:customer).and_yield(double.as_null_object).and_return(mock_auto_tagging_operation)
        allow(@mock_customer_service).to receive(:mutate_customer).and_return(mock_mutate_customer_response_auto_tagging)
      end

      it "enables auto-tagging" do
        expect(@mock_customer_service).to receive(:mutate_customer)
        syncer.sync
      end
    end
  end

  describe "#delete" do
    context "when remote customer exists" do
      before do
        ads_account.google_customer_id = "123456"
        ads_account.save!
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(
            mock_search_response_with_customer(customer_id: 123456, auto_tagging_enabled: true),
            mock_search_response_with_customer(customer_id: 123456, auto_tagging_enabled: true)
          )
        allow(@mock_update_resource).to receive(:customer).and_yield(double.as_null_object).and_return(mock_customer_operation)
        allow(@mock_customer_service).to receive(:mutate_customer).and_return(mock_mutate_customer_response)
      end

      it "cancels the customer" do
        expect(@mock_customer_service).to receive(:mutate_customer).with(
          customer_id: "123456",
          operation: anything
        )
        syncer.delete
      end

      it "clears google_customer_id on ads_account" do
        syncer.delete
        expect(ads_account.reload.google_customer_id).to be_nil
      end

      it "sets status to CANCELED" do
        syncer.delete
        expect(ads_account.reload.google_status).to eq("CANCELED")
      end

      it "returns a deleted SyncResult" do
        result = syncer.delete
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.deleted?).to be true
      end
    end

    context "when remote customer does not exist" do
      before do
        allow(@mock_google_ads_service).to receive(:search).and_return(mock_empty_search_response)
      end

      it "returns not_found result" do
        result = syncer.delete
        expect(result.not_found?).to be true
      end
    end
  end

  describe "AdsAccount helper methods" do
    before do
      ads_account.google_customer_id = "123456"
      ads_account.save!
      allow(@mock_google_ads_service).to receive(:search)
        .and_return(
          mock_search_response_with_customer(
            customer_id: 123456,
            descriptive_name: account.name,
            auto_tagging_enabled: true
          ),
          mock_search_response_with_customer(customer_id: 123456, auto_tagging_enabled: true)
        )
    end

    describe "#google_synced?" do
      it "delegates to the syncer" do
        expect(ads_account.google_synced?).to be true
      end
    end

    describe "#google_sync_result" do
      it "returns the sync result" do
        result = ads_account.google_sync_result
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
      end
    end

    describe "#google_sync" do
      it "syncs the account" do
        result = ads_account.google_sync
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
      end
    end
  end

  describe "#send_google_ads_invitation_email" do
    before do
      ads_account.google_customer_id = "123456"
      ads_account.save!
      mock_customer_user_access_invitation_service
      allow(@mock_resource).to receive(:customer_user_access_invitation)
        .and_yield(mock_customer_user_access_invitation_resource)
        .and_return(mock_customer_user_access_invitation_resource)
      allow(@mock_operation).to receive(:create_resource)
        .and_return(double("CreateResource", customer_user_access_invitation: double("Operation")))
      allow(@mock_customer_user_access_invitation_service).to receive(:mutate_customer_user_access_invitation)
        .and_return(mock_mutate_customer_user_access_invitation_response(customer_id: "123456"))
    end

    context "when account has connected Google account" do
      it "sends invitation to the connected account email" do
        expect(@mock_customer_user_access_invitation_service).to receive(:mutate_customer_user_access_invitation)
          .with(customer_id: "123456", operation: anything)
        syncer.send_google_ads_invitation_email
      end

      it "returns a SyncResult with created action" do
        result = syncer.send_google_ads_invitation_email
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.created?).to be true
        expect(result.resource_type).to eq(:customer_user_access_invitation)
      end
    end

    context "when explicit email is provided" do
      it "sends invitation to the provided email" do
        expect(@mock_customer_user_access_invitation_service).to receive(:mutate_customer_user_access_invitation)
        syncer.send_google_ads_invitation_email(email_address: "other@example.com")
      end
    end

    context "when no customer_id exists" do
      before do
        ads_account.google_customer_id = nil
        ads_account.save!
      end

      it "raises ArgumentError" do
        expect { syncer.send_google_ads_invitation_email }.to raise_error(ArgumentError, /google_customer_id/)
      end
    end

    context "when no connected Google account and no email provided" do
      let(:account) { create(:account, name: "Test Account") }

      it "raises ArgumentError" do
        expect { syncer.send_google_ads_invitation_email }.to raise_error(ArgumentError, /Email address is required/)
      end
    end
  end
end
