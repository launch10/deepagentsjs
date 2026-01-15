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
class AdsAccount < ApplicationRecord
  include PlatformSettings

  belongs_to :account
  has_many :invitations, class_name: "AdsAccountInvitation", dependent: :destroy
  has_many :campaigns

  PLATFORMS = %w[google meta]
  # https://developers.google.com/google-ads/api/data/codes-formats
  CURRENCY_CODES = %w[AED ARS AUD BGN BND BOB BRL CAD CHF CLP CNY COP CSD CZK DEM DKK EEK EGP EUR FJD FRF GBP HKD HRK HUF IDR ILS INR JOD JPY KES KRW LKR LTL MAD MTL MXN MYR NGN NOK NZD PEN PHP PKR PLN RON RSD RUB SAR SEK SGD SIT SKK THB TND TRL TRY TWD UAH USD UYU VEB VEF VND ZAR]
  TIME_ZONES = ActiveSupport::TimeZone.all.map(&:tzinfo).map(&:name)

  validates :platform, presence: true, inclusion: { in: PLATFORMS }
  validate :google_auto_tagging_must_be_enabled

  platform_setting :google, :customer_id
  platform_setting :google, :descriptive_name, default: -> { account&.owner&.email || EST.now.strftime("%Y-%m-%d %H:%M:%S Ads Account") }
  platform_setting :google, :currency_code, default: -> { account&.try(:currency_code).presence || "USD" }, in: CURRENCY_CODES
  platform_setting :google, :time_zone, default: -> { account&.try(:time_zone).presence || "America/New_York" }, in: TIME_ZONES
  platform_setting :google, :status, default: "ENABLED"
  platform_setting :google, :auto_tagging_enabled, default: true
  platform_setting :google, :conversion_action_resource_name
  platform_setting :google, :conversion_id      # Full conversion ID with AW- prefix (e.g., "AW-123456789")
  platform_setting :google, :conversion_label   # Conversion label from tag_snippets (e.g., "abc123XYZ")
  platform_setting :google, :billing_status     # Billing setup status: pending, approved, cancelled

  def google_send_to
    return nil unless google_conversion_id.present? && google_conversion_label.present?
    "#{google_conversion_id}/#{google_conversion_label}"
  end

  def google_billing_enabled?
    google_billing_status == "approved"
  end

  def google_sync
    google_syncer.sync
  end

  def google_synced?
    google_syncer.synced?
  end

  def google_delete
    google_syncer.delete
  end

  def google_fetch
    google_syncer.fetch
  end

  def to_google_json
    google_syncer.to_google_json
  end

  def google_sync_result
    google_syncer.sync_result
  end

  def google_syncer
    GoogleAds::Resources::Account.new(self)
  end

  def sync_campaigns
    GoogleAds::Resources::Campaign.sync_all(self)
  end

  def campaigns_synced?
    GoogleAds::Resources::Campaign.synced?(self)
  end

  def campaigns_sync_plan
    GoogleAds::Resources::Campaign.sync_plan(self)
  end

  def google_account_invitation
    invitations.where(platform: "google").order(id: :desc).first
  end

  def send_google_ads_invitation_email(access_role: :STANDARD, force: false)
    raise "Google Ads account must have a google_customer_id" unless google_customer_id.present?
    raise "Account must have a connected Google account" unless account.google_email_address.present?

    existing = invitations.find_by(email_address: account.google_email_address, platform: "google")
    return existing.google_sync_result if existing && !force

    invitation = invitations.create!(
      email_address: account.google_email_address,
      platform: "google",
      google_access_role: access_role.to_s
    )
    invitation.google_sync
  end

  def invitation_for(email_address)
    invitations.find_by(email_address: email_address, platform: platform)
  end

  private

  def google_auto_tagging_must_be_enabled
    return unless platform == "google"
    return if google_auto_tagging_enabled == true

    errors.add(:google_auto_tagging_enabled, "must be enabled for conversion tracking and analytics")
  end
end
