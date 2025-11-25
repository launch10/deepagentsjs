# == Schema Information
#
# Table name: ad_location_targets
#
#  id                  :bigint           not null, primary key
#  address_line_1      :string
#  city                :string
#  country_code        :string
#  latitude            :decimal(10, 6)
#  location_identifier :string
#  location_name       :string
#  location_type       :string
#  longitude           :decimal(10, 6)
#  negative            :boolean          default(FALSE), not null
#  platform_ids        :jsonb
#  postal_code         :string
#  radius              :decimal(10, 2)
#  radius_units        :string
#  state               :string
#  target_type         :string           not null
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#  campaign_id         :bigint
#
# Indexes
#
#  index_ad_location_targets_on_campaign_id          (campaign_id)
#  index_ad_location_targets_on_location_identifier  (location_identifier)
#  index_ad_location_targets_on_platform_ids         (platform_ids) USING gin
#
class AdLocationTarget < ApplicationRecord
  belongs_to :campaign
end
