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
class AdsAccountInvitation < ApplicationRecord
  include PlatformSettings
  include GoogleMappable
  include GoogleSyncable

  belongs_to :ads_account

  PLATFORMS = %w[google meta]
  STATUSES = %w[pending sent accepted declined expired]
  ACCESS_ROLES = %w[ADMIN STANDARD READ_ONLY EMAIL_ONLY]

  validates :platform, presence: true, inclusion: { in: PLATFORMS }
  validates :email_address, presence: true

  platform_setting :google, :access_role, default: "ADMIN", in: ACCESS_ROLES
  platform_setting :google, :status, default: "pending", in: STATUSES
  platform_setting :google, :invitation_id
  platform_setting :google, :user_access_id
  platform_setting :google, :sent_at
  platform_setting :google, :accepted_at

  use_google_sync GoogleAds::AccountInvitation
  after_google_sync :update_from_sync_result

  scope :pending, -> { where("platform_settings->>'google'->>'status' = ?", "pending") }
  scope :sent, -> { where("platform_settings->'google'->>'status' = ?", "sent") }
  scope :accepted, -> { where("platform_settings->'google'->>'status' = ?", "accepted") }

  def update_from_sync_result(result)
    return unless result.resource_name.present?

    if result.resource_type == :customer_user_access_invitation
      self.google_invitation_id = result.resource_name.split("/").last
      self.google_status = "sent"
      self.google_sent_at = Time.current.iso8601
    elsif result.resource_type == :customer_user_access
      self.google_user_access_id = result.resource_name.split("/").last
      self.google_status = "accepted"
      self.google_accepted_at = Time.current.iso8601
    end

    save!
  end

  def okay?
    !declined? && !expired?
  end

  def pending?
    google_status == "pending"
  end

  def sent?
    google_sent_at.present? && okay?
  end

  def accepted?
    google_status == "accepted"
  end

  def declined?
    google_status == "declined"
  end

  def expired?
    google_status == "expired"
  end

  def customer_id
    ads_account&.google_customer_id
  end
end
