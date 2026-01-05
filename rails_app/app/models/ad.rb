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

  belongs_to :ad_group
  has_one :campaign, through: :ad_group
  has_one :ads_account, through: :campaign
  has_one :website, through: :campaign

  has_many :headlines, dependent: :destroy, class_name: "AdHeadline"
  has_many :descriptions, dependent: :destroy, class_name: "AdDescription"

  accepts_nested_attributes_for :headlines, allow_destroy: true
  accepts_nested_attributes_for :descriptions, allow_destroy: true

  platform_setting :google, :ad_id

  def enable!
    self.status = "active"
    save!
  end

  def pause!
    self.status = "paused"
    save!
  end

  def to_google_json
    GoogleAds::Resources::Ad.new(self).to_google_json
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

  def google_syncer
    @google_syncer ||= GoogleAds::Resources::Ad.new(self)
  end

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
