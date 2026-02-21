# == Schema Information
#
# Table name: ads_accounts
#
#  id                :bigint           not null, primary key
#  deleted_at        :datetime
#  platform          :string           not null
#  platform_settings :jsonb
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  account_id        :bigint           not null
#
# Indexes
#
#  index_ads_accounts_on_account_id               (account_id)
#  index_ads_accounts_on_account_id_and_platform  (account_id,platform) UNIQUE
#  index_ads_accounts_on_deleted_at               (deleted_at)
#  index_ads_accounts_on_google_id                (((platform_settings ->> 'google'::text)))
#  index_ads_accounts_on_platform                 (platform)
#  index_ads_accounts_on_platform_settings        (platform_settings) USING gin
#
require 'rails_helper'

RSpec.describe AdsAccount, type: :model do
  include GoogleAdsMocks

  let(:account) { create(:account, name: "Test Account", time_zone: "America/Los_Angeles") }
  let(:ads_account) { account.ads_accounts.create!(platform: "google") }

  describe 'associations' do
    it { should belong_to(:account) }
  end

  describe 'validations' do
    it { should validate_presence_of(:platform) }
    it { should validate_inclusion_of(:platform).in_array(AdsAccount::PLATFORMS) }

    describe 'google_currency_code' do
      it 'allows valid currency codes' do
        %w[USD EUR GBP JPY AUD CAD].each do |code|
          ads_account.google_currency_code = code
          ads_account.valid?
          expect(ads_account.errors[:google_currency_code]).to be_empty, "Expected #{code} to be valid"
        end
      end

      it 'rejects invalid currency codes' do
        ads_account.google_currency_code = "INVALID"
        expect(ads_account).not_to be_valid
        expect(ads_account.errors[:google_currency_code]).to include("is not a valid option")
      end

      it 'allows blank values' do
        ads_account.google_currency_code = nil
        expect(ads_account).to be_valid
      end
    end

    describe 'google_time_zone' do
      it 'allows valid time zones' do
        %w[America/New_York America/Los_Angeles Europe/London Asia/Tokyo].each do |tz|
          ads_account.google_time_zone = tz
          expect(ads_account).to be_valid
        end
      end

      it 'rejects invalid time zones' do
        ads_account.google_time_zone = "Invalid/Timezone"
        expect(ads_account).not_to be_valid
        expect(ads_account.errors[:google_time_zone]).to include("is not a valid option")
      end

      it 'allows blank values' do
        ads_account.google_time_zone = nil
        expect(ads_account).to be_valid
      end

      it 'includes all ActiveSupport time zones' do
        ActiveSupport::TimeZone.all.map(&:tzinfo).map(&:name).uniq.each do |tz|
          ads_account.google_time_zone = tz
          expect(ads_account).to be_valid, "Expected #{tz} to be valid"
        end
      end
    end
  end

  describe 'platform_settings' do
    describe 'google_customer_id' do
      it 'stores and retrieves customer_id' do
        ads_account.google_customer_id = "123456789"
        ads_account.save!

        expect(ads_account.reload.google_customer_id).to eq("123456789")
      end
    end

    describe 'google_descriptive_name' do
      it 'defaults to account owner email' do
        expect(ads_account.google_descriptive_name).to eq(account.owner.email)
      end

      it 'can be overridden' do
        ads_account.google_descriptive_name = "Custom Name"
        ads_account.save!

        expect(ads_account.reload.google_descriptive_name).to eq("Custom Name")
      end
    end

    describe 'google_currency_code' do
      it 'defaults to USD' do
        expect(ads_account.google_currency_code).to eq("USD")
      end

      it 'can be set to a custom value' do
        ads_account.google_currency_code = "EUR"
        ads_account.save!

        expect(ads_account.reload.google_currency_code).to eq("EUR")
      end
    end

    describe 'google_time_zone' do
      it 'uses account time_zone when available' do
        expect(ads_account.google_time_zone).to eq("America/Los_Angeles")
      end

      it 'defaults to America/New_York when account has no time_zone' do
        account.update!(time_zone: nil)
        new_ads_account = account.ads_accounts.create!(platform: "google")

        expect(new_ads_account.google_time_zone).to eq("America/New_York")
      end
    end

    describe 'google_status' do
      it 'defaults to ENABLED' do
        expect(ads_account.google_status).to eq("ENABLED")
      end

      it 'can be set to other values' do
        ads_account.google_status = "CANCELED"
        ads_account.save!

        expect(ads_account.reload.google_status).to eq("CANCELED")
      end
    end

    describe 'google_auto_tagging_enabled' do
      it 'defaults to true' do
        expect(ads_account.google_auto_tagging_enabled).to eq(true)
      end

      it 'cannot be set to false (required for conversion tracking)' do
        ads_account.google_auto_tagging_enabled = false

        expect(ads_account).not_to be_valid
        expect(ads_account.errors[:google_auto_tagging_enabled]).to include("must be enabled for conversion tracking and analytics")
      end

      it 'can be explicitly set to true' do
        ads_account.google_auto_tagging_enabled = true
        expect(ads_account).to be_valid
      end
    end
  end

  describe 'Google Ads sync delegation' do
    it 'uses GoogleAds::Resources::Account syncer' do
      expect(ads_account.google_syncer).to be_a(GoogleAds::Resources::Account)
    end

    it 'responds to google_sync' do
      expect(ads_account).to respond_to(:google_sync)
    end

    it 'responds to google_synced?' do
      expect(ads_account).to respond_to(:google_synced?)
    end

    it 'responds to google_fetch' do
      expect(ads_account).to respond_to(:google_fetch)
    end

    it 'responds to google_delete' do
      expect(ads_account).to respond_to(:google_delete)
    end
  end

  describe 'to_google_json' do
    before do
      ads_account.google_descriptive_name = "My Account"
      ads_account.google_currency_code = "USD"
      ads_account.google_time_zone = "America/New_York"
      ads_account.google_status = "ENABLED"
      ads_account.google_auto_tagging_enabled = true
      ads_account.save!
    end

    it 'converts to Google API format' do
      json = ads_account.to_google_json

      expect(json[:descriptive_name]).to eq("My Account")
      expect(json[:currency_code]).to eq("USD")
      expect(json[:time_zone]).to eq("America/New_York")
      expect(json[:auto_tagging_enabled]).to eq(true)
    end
  end

  describe '#send_google_ads_invitation_email' do
    let(:account) { create(:account, :with_google_account, name: "Test Account") }

    before do
      mock_google_ads_client
      ads_account.google_customer_id = "123456"
      ads_account.save!
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

    context 'when account has connected Google account and customer_id' do
      it 'creates an AdsAccountInvitation record' do
        expect { ads_account.send_google_ads_invitation_email }
          .to change { ads_account.invitations.count }.by(1)
      end

      it 'sends invitation email via the syncer' do
        expect(@mock_customer_user_access_invitation_service).to receive(:mutate_customer_user_access_invitation)
        ads_account.send_google_ads_invitation_email
      end

      it 'returns a SyncResult' do
        result = ads_account.send_google_ads_invitation_email
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
        expect(result.created?).to be true
      end

      it 'uses connected account email by default' do
        ads_account.send_google_ads_invitation_email
        invitation = ads_account.invitations.last
        expect(invitation.email_address).to eq(account.google_email_address)
      end
      it 'uses ADMIN access role by default' do
        ads_account.send_google_ads_invitation_email
        invitation = ads_account.invitations.last
        expect(invitation.google_access_role).to eq("ADMIN")
      end
    end

    context 'when customer_id is missing' do
      before do
        ads_account.google_customer_id = nil
        ads_account.save!
      end

      it 'raises an error' do
        expect { ads_account.send_google_ads_invitation_email }
          .to raise_error("Google Ads account must have a google_customer_id")
      end
    end

    context 'when account has no connected Google account' do
      let(:account) { create(:account, name: "Test Account") }

      it 'raises an error' do
        expect { ads_account.send_google_ads_invitation_email }
          .to raise_error("Account must have a connected Google account")
      end
    end

    context 'with custom access_role' do
      it 'passes access_role to the invitation' do
        ads_account.send_google_ads_invitation_email(access_role: :STANDARD)
        invitation = ads_account.invitations.last
        expect(invitation.google_access_role).to eq("STANDARD")
      end
    end

    context 'when invitation already exists for email' do
      let!(:existing_invitation) do
        ads_account.invitations.create!(email_address: account.google_email_address, platform: "google")
      end

      before do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_search_response_with_invitation(
            email_address: account.google_email_address,
            customer_id: "123456"
          ))
      end

      it 'does not create a new invitation by default' do
        expect { ads_account.send_google_ads_invitation_email }
          .not_to change { ads_account.invitations.count }
      end

      it 'returns the existing invitation sync result' do
        result = ads_account.send_google_ads_invitation_email
        expect(result).to be_a(GoogleAds::Sync::SyncResult)
      end

      it 'creates a new invitation when force: true' do
        expect { ads_account.send_google_ads_invitation_email(force: true) }
          .to change { ads_account.invitations.count }.by(1)
      end

      it 'syncs the new invitation when force: true' do
        allow(@mock_google_ads_service).to receive(:search)
          .and_return(mock_empty_search_response)
        allow(@mock_resource).to receive(:customer_user_access_invitation)
          .and_yield(mock_customer_user_access_invitation_resource)
          .and_return(mock_customer_user_access_invitation_resource)
        allow(@mock_operation).to receive(:create_resource)
          .and_return(double("CreateResource", customer_user_access_invitation: double("Operation")))
        allow(@mock_customer_user_access_invitation_service).to receive(:mutate_customer_user_access_invitation)
          .and_return(mock_mutate_customer_user_access_invitation_response(customer_id: "123456"))

        expect(@mock_customer_user_access_invitation_service).to receive(:mutate_customer_user_access_invitation)
        ads_account.send_google_ads_invitation_email(force: true)
      end
    end
  end

  describe '#invitation_for' do
    let(:account) { create(:account, :with_google_account, name: "Test Account") }

    it 'finds invitation by email address' do
      invitation = ads_account.invitations.create!(
        email_address: "test@example.com",
        platform: "google"
      )

      expect(ads_account.invitation_for("test@example.com")).to eq(invitation)
    end

    it 'returns nil when no invitation exists' do
      expect(ads_account.invitation_for("nonexistent@example.com")).to be_nil
    end
  end
end
