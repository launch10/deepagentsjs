# == Schema Information
#
# Table name: ads
#
#  id                :bigint           not null, primary key
#  deleted_at        :datetime
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
#  index_ads_on_deleted_at              (deleted_at)
#  index_ads_on_google_id               ((((platform_settings -> 'google'::text) ->> 'ad_id'::text)))
#  index_ads_on_platform_settings       (platform_settings) USING gin
#  index_ads_on_status                  (status)
#
class Ad < ApplicationRecord
  include PlatformSettings
  include GoogleMappable

  belongs_to :ad_group
  has_one :campaign, through: :ad_group
  has_one :ads_account, through: :campaign
  has_one :website, through: :campaign

  has_many :headlines, dependent: :destroy, class_name: "AdHeadline"
  has_many :descriptions, dependent: :destroy, class_name: "AdDescription"

  accepts_nested_attributes_for :headlines, allow_destroy: true
  accepts_nested_attributes_for :descriptions, allow_destroy: true

  platform_setting :google, :ad_id

  # ═══════════════════════════════════════════════════════════════
  # GOOGLE SYNC (explicit one-liner delegations, no DSL magic)
  # Callback logic (set_google_ad_id) is INSIDE the resource
  # ═══════════════════════════════════════════════════════════════

  def google_sync = GoogleAds::Resources::Ad.new(self).sync
  def google_synced? = GoogleAds::Resources::Ad.new(self).synced?
  def google_delete = GoogleAds::Resources::Ad.new(self).delete
  def google_fetch = GoogleAds::Resources::Ad.new(self).fetch
  def google_syncer = GoogleAds::Resources::Ad.new(self)

  def google_customer_id
    ads_account.google_customer_id
  end

  def google_ad_group_id
    ad_group.google_ad_group_id
  end

  def google_campaign_id
    campaign.google_campaign_id
  end

  def final_urls
    return [] unless website&.website_urls&.any?

    website_url = website.website_urls.first
    ["https://#{website_url.domain.domain}#{website_url.path}"]
  end
end
