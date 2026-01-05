# == Schema Information
#
# Table name: ad_groups
#
#  id                :bigint           not null, primary key
#  deleted_at        :datetime
#  name              :string
#  platform_settings :jsonb
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  campaign_id       :bigint
#
# Indexes
#
#  index_ad_groups_on_campaign_id           (campaign_id)
#  index_ad_groups_on_campaign_id_and_name  (campaign_id,name)
#  index_ad_groups_on_created_at            (created_at)
#  index_ad_groups_on_deleted_at            (deleted_at)
#  index_ad_groups_on_google_id             ((((platform_settings -> 'google'::text) ->> 'ad_group_id'::text)))
#  index_ad_groups_on_name                  (name)
#  index_ad_groups_on_platform_settings     (platform_settings) USING gin
#
class AdGroup < ApplicationRecord
  include PlatformSettings
  include GoogleMappable

  acts_as_paranoid

  belongs_to :campaign
  has_one :ads_account, through: :campaign
  has_many :ads, dependent: :destroy
  has_many :keywords, dependent: :destroy, class_name: "AdKeyword"
  has_many :headlines, through: :ads
  has_many :descriptions, through: :ads
  has_many :callouts, dependent: :destroy, class_name: "AdCallout"

  validates :name, presence: true

  accepts_nested_attributes_for :ads, allow_destroy: true
  accepts_nested_attributes_for :keywords, allow_destroy: true

  def google_customer_id
    campaign.google_customer_id
  end

  platform_setting :google, :ad_group_id
  platform_setting :google, :status, default: "PAUSED"
  platform_setting :google, :type, default: "SEARCH_STANDARD"
  platform_setting :google, :cpc_bid_micros, default: 1_000_000

  # ═══════════════════════════════════════════════════════════════
  # GOOGLE SYNC (explicit one-liner delegations, no DSL magic)
  # Callback logic (save_ad_group_id) is INSIDE the resource
  # ═══════════════════════════════════════════════════════════════

  def google_sync = GoogleAds::Resources::AdGroup.new(self).sync
  def google_synced? = GoogleAds::Resources::AdGroup.new(self).synced?
  def google_delete = GoogleAds::Resources::AdGroup.new(self).delete
  def google_fetch = GoogleAds::Resources::AdGroup.new(self).fetch
  def google_syncer = GoogleAds::Resources::AdGroup.new(self)

  # ═══════════════════════════════════════════════════════════════
  # COLLECTION SYNC - Ads (explicit one-liner delegations)
  # ═══════════════════════════════════════════════════════════════

  def sync_ads = GoogleAds::Resources::Ad.sync_all(self)
  def ads_sync_plan = GoogleAds::Resources::Ad.sync_plan(self)
  def ads_synced? = GoogleAds::Resources::Ad.synced?(self)

  # ═══════════════════════════════════════════════════════════════
  # COLLECTION SYNC - Keywords (uses old Syncable pattern until refactored)
  # ═══════════════════════════════════════════════════════════════

  def sync_keywords = GoogleAds::Keywords.new(self).sync
  def keywords_synced? = GoogleAds::Keywords.new(self).synced?
end
