# == Schema Information
#
# Table name: ad_descriptions
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
#  index_ad_descriptions_on_ad_id              (ad_id)
#  index_ad_descriptions_on_asset_id           ((((platform_settings -> 'google'::text) ->> 'asset_id'::text)))
#  index_ad_descriptions_on_created_at         (created_at)
#  index_ad_descriptions_on_platform_settings  (platform_settings) USING gin
#  index_ad_descriptions_on_position           (position)
#
class AdDescription < ApplicationRecord
  belongs_to :ad, class_name: "Ad", inverse_of: :descriptions
  has_one :campaign, through: :ad
end
