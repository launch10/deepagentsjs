# == Schema Information
#
# Table name: ad_structured_snippets
#
#  id                :bigint           not null, primary key
#  category          :string           not null
#  deleted_at        :datetime
#  platform_settings :jsonb
#  values            :jsonb            not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  campaign_id       :bigint           not null
#
# Indexes
#
#  index_ad_structured_snippets_on_asset_id           ((((platform_settings -> 'google'::text) ->> 'asset_id'::text)))
#  index_ad_structured_snippets_on_campaign_id        (campaign_id)
#  index_ad_structured_snippets_on_category           (category)
#  index_ad_structured_snippets_on_created_at         (created_at)
#  index_ad_structured_snippets_on_deleted_at         (deleted_at)
#  index_ad_structured_snippets_on_platform_settings  (platform_settings) USING gin
#
class AdStructuredSnippet < ApplicationRecord
  include PlatformSettings
  include GoogleSyncable

  platform_setting :google, :asset_id

  include AdStructuredSnippetConcerns::Categories

  acts_as_paranoid

  belongs_to :campaign

  use_google_sync GoogleAds::StructuredSnippet

  after_google_sync do |result|
    if result.resource_name.present?
      asset_id = result.resource_name.split("/").last
      update_column(:platform_settings, platform_settings.deep_merge("google" => { "asset_id" => asset_id }))
    end
  end

  validates :category, presence: true
  validates :values, presence: true, length: { minimum: 3, maximum: 10 }
end
