# == Schema Information
#
# Table name: ads
#
#  id                :bigint           not null, primary key
#  display_path_1    :string
#  display_path_2    :string
#  platform_settings :jsonb
#  status            :string           default("draft")
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  ad_group_id       :bigint
#
# Indexes
#
#  index_ads_on_ad_group_id             (ad_group_id)
#  index_ads_on_ad_group_id_and_status  (ad_group_id,status)
#  index_ads_on_google_id               ((((platform_settings -> 'google'::text) ->> 'ad_id'::text)))
#  index_ads_on_platform_settings       (platform_settings) USING gin
#  index_ads_on_status                  (status)
#
class Ad < ApplicationRecord
  include PlatformSettings

  belongs_to :ad_group
  has_one :campaign, through: :ad_group
  has_one :ads_account, through: :campaign

  has_many :headlines, dependent: :destroy, class_name: "AdHeadline"
  has_many :descriptions, dependent: :destroy, class_name: "AdDescription"

  platform_setting :google, :ad_id

  def google_customer_id
    ads_account.google_customer_id
  end

  def google_ad_group_id
    ad_group.google_ad_group_id
  end

  def google_campaign_id
    campaign.google_campaign_id
  end
end
