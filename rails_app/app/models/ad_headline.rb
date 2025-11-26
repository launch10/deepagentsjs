# == Schema Information
#
# Table name: ad_headlines
#
#  id                :bigint           not null, primary key
#  platform_settings :jsonb
#  position          :integer          not null
#  text              :string           not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  ad_id             :bigint           not null
#
# Indexes
#
#  index_ad_headlines_on_ad_id               (ad_id)
#  index_ad_headlines_on_ad_id_and_position  (ad_id,position)
#  index_ad_headlines_on_asset_id            ((((platform_settings -> 'google'::text) ->> 'asset_id'::text)))
#  index_ad_headlines_on_created_at          (created_at)
#  index_ad_headlines_on_platform_settings   (platform_settings) USING gin
#  index_ad_headlines_on_position            (position)
#
class AdHeadline < ApplicationRecord
  include PlatformSettings
  platform_setting :google, :asset_id

  belongs_to :ad, class_name: "Ad", inverse_of: :headlines
  has_one :campaign, through: :ad

  validates :text, presence: true, length: { maximum: 30 }
  validates :position, presence: true

  attr_accessor :skip_position_uniqueness_validation

  validate :unique_position_within_ad, unless: :skip_position_uniqueness_validation

  private

  def unique_position_within_ad
    return unless ad

    existing = AdHeadline
      .where(ad_id: ad.id)
      .where(position: position)
      .where.not(id: id)
      .exists?

    errors.add(:position, "must be unique within ad") if existing
  end
end
