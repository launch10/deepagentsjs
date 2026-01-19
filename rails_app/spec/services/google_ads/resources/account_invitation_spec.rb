require "rails_helper"

RSpec.describe GoogleAds::Resources::AccountInvitation do
  include GoogleAdsMocks

  let(:account) { create(:account, :with_google_account, name: "Test Account") }
  let(:ads_account) { account.ads_accounts.create!(platform: "google") }
  let(:invitation) do
    ads_account.invitations.create!(
      email_address: "user@example.com",
      platform: "google"
    )
  end
  let(:syncer) { described_class.new(invitation) }

  before do
    mock_google_ads_client
    ads_account.google_customer_id = "123456"
    ads_account.save!
  end

  describe "#fetch" do
    context "when user has accepted the invitation" do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_search_response_with_user_access(
            email_address: "user@example.com",
            customer_id: "123456"
          ))
      end

      it "returns a RemoteInvitation with accepted status" do
        remote = syncer.fetch
        expect(remote).to be_present
        expect(remote.accepted?).to be true
        expect(remote.email_address).to eq("user@example.com")
      end
    end

    context "when invitation is pending" do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)
          .and_return(mock_search_response_with_invitation(
            email_address: "user@example.com",
            customer_id: "123456",
            invitation_status: :PENDING
          ))
      end

      it "returns a RemoteInvitation with pending status" do
        remote = syncer.fetch
        expect(remote).to be_present
        expect(remote.pending?).to be true
      end
    end

    context "when no invitation or access exists" do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)
      end

      it "returns nil" do
        expect(syncer.fetch).to be_nil
      end
    end
  end

  describe "#sync_result" do
    context "when remote exists and is accepted" do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_search_response_with_user_access(
            email_address: "user@example.com",
            customer_id: "123456"
          ))
      end

      it "returns a sync result with customer_user_access type" do
        result = syncer.sync_result
        expect(result.resource_type).to eq(:customer_user_access)
        expect(result.action).to eq(:unchanged)
      end
    end

    context "when remote exists and is pending" do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)
          .and_return(mock_search_response_with_invitation(
            email_address: "user@example.com",
            customer_id: "123456",
            invitation_status: :PENDING
          ))
      end

      it "returns a sync result with invitation type" do
        result = syncer.sync_result
        expect(result.resource_type).to eq(:customer_user_access_invitation)
        expect(result.action).to eq(:unchanged)
      end
    end

    context "when remote does not exist" do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)
      end

      it "returns not_found result" do
        result = syncer.sync_result
        expect(result.not_found?).to be true
      end
    end
  end

  describe "#sync" do
    context "when already accepted" do
      before do
        mock_customer_user_access_invitation_service
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_search_response_with_user_access(
            email_address: "user@example.com",
            customer_id: "123456"
          ))
      end

      it "returns sync_result without creating new invitation" do
        expect(@mock_customer_user_access_invitation_service).not_to receive(:mutate_customer_user_access_invitation)
        result = syncer.sync
        expect(result.action).to eq(:unchanged)
      end
    end

    context "when pending invitation exists" do
      before do
        mock_customer_user_access_invitation_service
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)
          .and_return(mock_search_response_with_invitation(
            email_address: "user@example.com",
            customer_id: "123456",
            invitation_status: :PENDING
          ))
      end

      it "returns sync_result without creating new invitation" do
        expect(@mock_customer_user_access_invitation_service).not_to receive(:mutate_customer_user_access_invitation)
        result = syncer.sync
        expect(result.action).to eq(:unchanged)
      end
    end

    context "when no invitation exists" do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)
        mock_customer_user_access_invitation_service
        allow(@mock_resource).to receive(:customer_user_access_invitation)
          .and_yield(mock_customer_user_access_invitation_resource)
          .and_return(mock_customer_user_access_invitation_resource)
        allow(@mock_operation).to receive(:create_resource)
          .and_return(double("CreateResource", customer_user_access_invitation: double("Operation")))
        allow(@mock_customer_user_access_invitation_service).to receive(:mutate_customer_user_access_invitation)
          .and_return(mock_mutate_customer_user_access_invitation_response(customer_id: "123456"))
      end

      it "creates a new invitation" do
        expect(@mock_customer_user_access_invitation_service).to receive(:mutate_customer_user_access_invitation)
        syncer.sync
      end

      it "returns created SyncResult" do
        result = syncer.sync
        expect(result.created?).to be true
        expect(result.resource_type).to eq(:customer_user_access_invitation)
      end
    end

    context "when customer_id is missing" do
      before do
        ads_account.google_customer_id = nil
        ads_account.save!
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)
      end

      it "raises ArgumentError" do
        expect { syncer.sync }.to raise_error(ArgumentError, /Customer ID is required/)
      end
    end
  end

  describe "#refresh_status" do
    context "when invitation was accepted" do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_search_response_with_user_access(
            email_address: "user@example.com",
            customer_id: "123456"
          ))
      end

      it "returns updated action" do
        result = syncer.refresh_status
        expect(result.action).to eq(:updated)
        expect(result.resource_type).to eq(:customer_user_access)
      end

      it "updates the invitation record status to accepted" do
        expect { syncer.refresh_status }.to change { invitation.reload.google_status }.to("accepted")
      end

      it "sets the accepted_at timestamp" do
        syncer.refresh_status
        expect(invitation.reload.google_accepted_at).to be_present
      end

      it "sets the user_access_id from the resource name" do
        syncer.refresh_status
        expect(invitation.reload.google_user_access_id).to be_present
      end
    end

    context "when invitation is still pending" do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)
          .and_return(mock_search_response_with_invitation(
            email_address: "user@example.com",
            customer_id: "123456",
            invitation_status: :PENDING
          ))
      end

      it "returns unchanged action" do
        result = syncer.refresh_status
        expect(result.action).to eq(:unchanged)
      end
    end

    context "when invitation was declined" do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)
          .and_return(mock_search_response_with_invitation(
            email_address: "user@example.com",
            customer_id: "123456",
            invitation_status: :DECLINED
          ))
      end

      it "returns declined action" do
        result = syncer.refresh_status
        expect(result.action).to eq(:declined)
      end
    end

    context "when invitation expired" do
      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)
          .and_return(mock_search_response_with_invitation(
            email_address: "user@example.com",
            customer_id: "123456",
            invitation_status: :EXPIRED
          ))
      end

      it "returns expired action" do
        result = syncer.refresh_status
        expect(result.action).to eq(:expired)
      end
    end
  end

  describe "RemoteInvitation" do
    describe ".from_user_access" do
      it "creates RemoteInvitation with accepted status" do
        user_access = double("CustomerUserAccess",
          resource_name: "customers/123/customerUserAccess/456",
          email_address: "test@example.com",
          access_role: :ADMIN,
          access_creation_date_time: "2024-01-01")

        remote = GoogleAds::Resources::AccountInvitation::RemoteInvitation.from_user_access(user_access)

        expect(remote.accepted?).to be true
        expect(remote.email_address).to eq("test@example.com")
        expect(remote.access_role).to eq(:ADMIN)
      end

      it "returns nil when user_access is nil" do
        expect(GoogleAds::Resources::AccountInvitation::RemoteInvitation.from_user_access(nil)).to be_nil
      end
    end

    describe ".from_invitation" do
      it "creates RemoteInvitation with invitation status" do
        invitation = double("CustomerUserAccessInvitation",
          resource_name: "customers/123/customerUserAccessInvitations/789",
          email_address: "test@example.com",
          access_role: :ADMIN,
          invitation_status: :PENDING,
          creation_date_time: "2024-01-01")

        remote = GoogleAds::Resources::AccountInvitation::RemoteInvitation.from_invitation(invitation)

        expect(remote.pending?).to be true
        expect(remote.accepted?).to be false
        expect(remote.email_address).to eq("test@example.com")
      end

      it "returns nil when invitation is nil" do
        expect(GoogleAds::Resources::AccountInvitation::RemoteInvitation.from_invitation(nil)).to be_nil
      end
    end
  end

  # ═══════════════════════════════════════════════════════════════
  # FIELD MAPPABLE
  # ═══════════════════════════════════════════════════════════════

  describe ".field_mappings" do
    it "registers all expected fields" do
      expect(described_class.field_mappings.keys).to contain_exactly(:email_address, :access_role)
    end

    it "has no immutable fields" do
      immutable_fields = described_class.field_mappings.select { |_, m| m[:immutable] }.keys
      expect(immutable_fields).to be_empty
    end

    it "returns all fields as mutable" do
      expect(described_class.mutable_fields).to contain_exactly(:email_address, :access_role)
    end
  end

  describe "#to_google_json" do
    it "returns email_address unchanged" do
      result = syncer.to_google_json
      expect(result[:email_address]).to eq("user@example.com")
    end

    it "transforms access_role to symbol" do
      invitation.google_access_role = "ADMIN"
      result = syncer.to_google_json
      expect(result[:access_role]).to eq(:ADMIN)
    end
  end

  describe "#from_google_json" do
    it "returns email_address and access_role from remote" do
      remote = GoogleAds::Resources::AccountInvitation::RemoteInvitation.new(
        resource_name: "customers/123/customerUserAccess/456",
        email_address: "test@example.com",
        access_role: :ADMIN,
        status: :ACCEPTED,
        created_at: "2024-01-01"
      )

      result = syncer.from_google_json(remote)
      expect(result[:email_address]).to eq("test@example.com")
      expect(result[:access_role]).to eq(:ADMIN)
    end
  end

  describe "#compare_fields" do
    it "compares email_address and access_role" do
      invitation.google_access_role = "ADMIN"
      invitation.save!

      remote = GoogleAds::Resources::AccountInvitation::RemoteInvitation.new(
        resource_name: "customers/123/customerUserAccess/456",
        email_address: "user@example.com",
        access_role: :ADMIN,
        status: :ACCEPTED,
        created_at: "2024-01-01"
      )

      comparison = syncer.compare_fields(remote)
      expect(comparison.match?).to be true
    end

    it "detects access_role mismatch" do
      invitation.google_access_role = "STANDARD"
      invitation.save!

      remote = GoogleAds::Resources::AccountInvitation::RemoteInvitation.new(
        resource_name: "customers/123/customerUserAccess/456",
        email_address: "user@example.com",
        access_role: :ADMIN,
        status: :ACCEPTED,
        created_at: "2024-01-01"
      )

      comparison = syncer.compare_fields(remote)
      expect(comparison.match?).to be false
      expect(comparison.failures).to include(:access_role)
    end
  end
end
