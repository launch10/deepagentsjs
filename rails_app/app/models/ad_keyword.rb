# == Schema Information
#
# Table name: ad_keywords
#
#  id                :bigint           not null, primary key
#  deleted_at        :datetime
#  match_type        :string           default("broad"), not null
#  platform_settings :jsonb
#  position          :integer          not null
#  text              :string(120)      not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  ad_group_id       :bigint           not null
#
# Indexes
#
#  index_ad_keywords_on_ad_group_id        (ad_group_id)
#  index_ad_keywords_on_created_at         (created_at)
#  index_ad_keywords_on_criterion_id       ((((platform_settings -> 'google'::text) ->> 'criterion_id'::text)))
#  index_ad_keywords_on_deleted_at         (deleted_at)
#  index_ad_keywords_on_match_type         (match_type)
#  index_ad_keywords_on_platform_settings  (platform_settings) USING gin
#  index_ad_keywords_on_position           (position)
#  index_ad_keywords_on_text               (text)
#
class AdKeyword < ApplicationRecord
  include PlatformSettings
  include GoogleMappable

  platform_setting :google, :criterion_id

  # ═══════════════════════════════════════════════════════════════
  # GOOGLE SYNC (explicit one-liner delegations, no DSL magic)
  # Callback logic (save_criterion_id) is INSIDE the resource
  # ═══════════════════════════════════════════════════════════════

  def google_sync = GoogleAds::Resources::Keyword.new(self).sync
  def google_synced? = GoogleAds::Resources::Keyword.new(self).synced?
  def google_delete = GoogleAds::Resources::Keyword.new(self).delete
  def google_fetch = GoogleAds::Resources::Keyword.new(self).fetch
  def google_syncer = GoogleAds::Resources::Keyword.new(self)

  acts_as_paranoid

  belongs_to :ad_group, class_name: "AdGroup", inverse_of: :keywords
  has_one :campaign, through: :ad_group
  has_one :ads_account, through: :campaign

  MATCH_TYPES = %w[broad phrase exact].freeze

  validates :text, presence: true, length: { maximum: 80 }
  validates :match_type, presence: true, inclusion: { in: MATCH_TYPES }
  validates :position, presence: true
end
