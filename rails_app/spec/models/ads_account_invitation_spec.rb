# == Schema Information
#
# Table name: ads_account_invitations
#
#  id                :bigint           not null, primary key
#  email_address     :string           not null
#  platform          :string           not null
#  platform_settings :jsonb
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  ads_account_id    :bigint           not null
#
# Indexes
#
#  idx_ads_account_invitations_lookup                  (ads_account_id,email_address,platform)
#  index_ads_account_invitations_on_ads_account_id     (ads_account_id)
#  index_ads_account_invitations_on_platform           (platform)
#  index_ads_account_invitations_on_platform_settings  (platform_settings) USING gin
#
# Foreign Keys
#
#  fk_rails_...  (ads_account_id => ads_accounts.id)
#
require 'rails_helper'

RSpec.describe AdsAccountInvitation, type: :model do
  include GoogleAdsMocks

  let(:account) { create(:account, :with_google_account, name: "Test Account") }
  let(:ads_account) { account.ads_accounts.create!(platform: "google") }

  before do
    ads_account.google_customer_id = "123456"
    ads_account.save!
  end

  describe 'associations' do
    it { should belong_to(:ads_account) }
  end

  describe 'validations' do
    subject { build(:ads_account_invitation, ads_account: ads_account) }

    it { should validate_presence_of(:platform) }
    it { should validate_inclusion_of(:platform).in_array(AdsAccountInvitation::PLATFORMS) }
    it { should validate_presence_of(:email_address) }
  end

  describe 'multiple invitations' do
    it 'allows multiple invitations for same email/platform/ads_account' do
      create(:ads_account_invitation, ads_account: ads_account, email_address: "test@example.com", platform: "google")

      duplicate = build(:ads_account_invitation, ads_account: ads_account, email_address: "test@example.com", platform: "google")
      expect(duplicate).to be_valid
    end
  end

  describe 'platform_settings' do
    let(:invitation) { create(:ads_account_invitation, ads_account: ads_account) }

    describe 'google_access_role' do
      it 'defaults to STANDARD' do
        expect(invitation.google_access_role).to eq("STANDARD")
      end

      it 'can be set to other valid roles' do
        invitation.google_access_role = "ADMIN"
        invitation.save!
        expect(invitation.reload.google_access_role).to eq("ADMIN")
      end

      it 'is invalid with an invalid role' do
        invitation.google_access_role = "INVALID"
        expect(invitation).not_to be_valid
        expect(invitation.errors[:google_access_role]).to include("is not a valid option")
      end
    end

    describe 'google_status' do
      it 'defaults to pending' do
        expect(invitation.google_status).to eq("pending")
      end

      it 'can be set to sent' do
        invitation.google_status = "sent"
        invitation.save!
        expect(invitation.reload.google_status).to eq("sent")
      end

      it 'is invalid with an invalid status' do
        invitation.google_status = "invalid_status"
        expect(invitation).not_to be_valid
        expect(invitation.errors[:google_status]).to include("is not a valid option")
      end
    end

    describe 'google_invitation_id' do
      it 'stores and retrieves invitation_id' do
        invitation.google_invitation_id = "invite123"
        invitation.save!
        expect(invitation.reload.google_invitation_id).to eq("invite123")
      end
    end

    describe 'google_user_access_id' do
      it 'stores and retrieves user_access_id' do
        invitation.google_user_access_id = "access456"
        invitation.save!
        expect(invitation.reload.google_user_access_id).to eq("access456")
      end
    end
  end

  describe 'status predicates' do
    let(:invitation) { create(:ads_account_invitation, ads_account: ads_account) }

    it '#pending? returns true when status is pending' do
      invitation.google_status = "pending"
      expect(invitation.pending?).to be true
      expect(invitation.sent?).to be false
    end

    it '#sent? returns true when sent_at is present and okay' do
      invitation.google_sent_at = Time.current.iso8601
      expect(invitation.sent?).to be true
    end

    it '#sent? returns false when declined' do
      invitation.google_sent_at = Time.current.iso8601
      invitation.google_status = "declined"
      expect(invitation.sent?).to be false
    end

    it '#accepted? returns true when status is accepted' do
      invitation.google_status = "accepted"
      expect(invitation.accepted?).to be true
    end

    it '#declined? returns true when status is declined' do
      invitation.google_status = "declined"
      expect(invitation.declined?).to be true
    end

    it '#expired? returns true when status is expired' do
      invitation.google_status = "expired"
      expect(invitation.expired?).to be true
    end
  end

  describe '#customer_id' do
    let(:invitation) { create(:ads_account_invitation, ads_account: ads_account) }

    it 'returns the ads_account google_customer_id' do
      expect(invitation.customer_id).to eq("123456")
    end
  end

  describe 'Google Sync delegation' do
    let(:invitation) { create(:ads_account_invitation, ads_account: ads_account) }

    it 'uses GoogleAds::Resources::AccountInvitation syncer' do
      expect(invitation.google_syncer).to be_a(GoogleAds::Resources::AccountInvitation)
    end

    it 'responds to google_sync' do
      expect(invitation).to respond_to(:google_sync)
    end

    it 'responds to google_synced?' do
      expect(invitation).to respond_to(:google_synced?)
    end

    it 'responds to google_delete' do
      expect(invitation).to respond_to(:google_delete)
    end

    it 'responds to google_fetch' do
      expect(invitation).to respond_to(:google_fetch)
    end

    it 'responds to google_refresh_status' do
      expect(invitation).to respond_to(:google_refresh_status)
    end
  end
end
