# == Schema Information
#
# Table name: ad_headlines
#
#  id         :bigint           not null, primary key
#  position   :integer          not null
#  text       :string           not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  ad_id      :bigint           not null
#
# Indexes
#
#  index_ad_headlines_on_ad_id               (ad_id)
#  index_ad_headlines_on_ad_id_and_position  (ad_id,position)
#  index_ad_headlines_on_created_at          (created_at)
#  index_ad_headlines_on_position            (position)
#
class AdHeadline < ApplicationRecord
  belongs_to :ad, class_name: "Ad", inverse_of: :headlines
  has_one :campaign, through: :ad

  validate :unique_position_within_campaign

  private

  def unique_position_within_campaign
    return unless ad&.campaign

    existing = AdHeadline.joins(:ad)
                        .where(ad_id: ad.id)
                        .where(position: position)
                        .where.not(id: id)
                        .exists?

    errors.add(:position, "must be unique within campaign") if existing
  end
end
