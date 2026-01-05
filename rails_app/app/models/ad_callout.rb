# == Schema Information
#
# Table name: ad_callouts
#
#  id                :bigint           not null, primary key
#  deleted_at        :datetime
#  platform_settings :jsonb
#  position          :integer          not null
#  text              :string           not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  ad_group_id       :bigint
#  campaign_id       :bigint           not null
#
# Indexes
#
#  index_ad_callouts_on_ad_group_id        (ad_group_id)
#  index_ad_callouts_on_asset_id           ((((platform_settings -> 'google'::text) ->> 'asset_id'::text)))
#  index_ad_callouts_on_campaign_id        (campaign_id)
#  index_ad_callouts_on_created_at         (created_at)
#  index_ad_callouts_on_deleted_at         (deleted_at)
#  index_ad_callouts_on_platform_settings  (platform_settings) USING gin
#  index_ad_callouts_on_position           (position)
#
class AdCallout < ApplicationRecord
  include PlatformSettings

  belongs_to :campaign, class_name: "Campaign", inverse_of: :callouts
  belongs_to :ad_group, class_name: "AdGroup", inverse_of: :callouts

  platform_setting :google, :asset_id

  validates :text, presence: true, length: { maximum: 25 }
  validates :position, presence: true

  acts_as_paranoid

  # ═══════════════════════════════════════════════════════════════
  # GOOGLE SYNC (explicit one-liner delegations, no DSL magic)
  # Callback logic (save_asset_id) is INSIDE the resource
  # ═══════════════════════════════════════════════════════════════

  def google_sync = GoogleAds::Resources::Callout.new(self).sync
  def google_synced? = GoogleAds::Resources::Callout.new(self).synced?
  def google_delete = GoogleAds::Resources::Callout.new(self).delete
  def google_fetch = GoogleAds::Resources::Callout.new(self).fetch
  def google_syncer = GoogleAds::Resources::Callout.new(self)
end
