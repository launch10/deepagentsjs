# == Schema Information
#
# Table name: ads_accounts
#
#  id                :bigint           not null, primary key
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
#  index_ads_accounts_on_google_id                (((platform_settings ->> 'google'::text)))
#  index_ads_accounts_on_platform                 (platform)
#  index_ads_accounts_on_platform_settings        (platform_settings) USING gin
#
class AdsAccount < ApplicationRecord
  include PlatformSettings

  belongs_to :account

  PLATFORMS = %w[google meta]
  validates :platform, presence: true, in: PLATFORMS

  platform_setting :google, :customer_id
end