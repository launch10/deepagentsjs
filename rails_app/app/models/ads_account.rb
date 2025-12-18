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
  include GoogleMappable
  include GoogleSyncable

  belongs_to :account

  PLATFORMS = %w[google meta]
  validates :platform, presence: true, inclusion: { in: PLATFORMS }

  platform_setting :google, :customer_id
  platform_setting :google, :descriptive_name, default: -> { account&.name }
  platform_setting :google, :currency_code, default: -> { account&.try(:currency_code).presence || "USD" }
  platform_setting :google, :time_zone, default: -> { account&.try(:time_zone).presence || "America/New_York" }
  platform_setting :google, :status, default: "ENABLED"
  platform_setting :google, :auto_tagging_enabled, default: true

  use_google_sync GoogleAds::Account
  after_google_sync :set_google_customer_id

  def set_google_customer_id(result)
    return unless result.resource_name.present?
    customer_id = result.resource_name.split("/").last
    self.google_customer_id = customer_id if customer_id.present?
  end
end
