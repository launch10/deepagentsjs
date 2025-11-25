# == Schema Information
#
# Table name: ad_callouts
#
#  id                :bigint           not null, primary key
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
#  index_ad_callouts_on_campaign_id        (campaign_id)
#  index_ad_callouts_on_created_at         (created_at)
#  index_ad_callouts_on_google_id          (((platform_settings ->> 'google'::text)))
#  index_ad_callouts_on_platform_settings  (platform_settings) USING gin
#  index_ad_callouts_on_position           (position)
#
class AdCallout < ApplicationRecord
  belongs_to :campaign, class_name: "Campaign", inverse_of: :callouts
  belongs_to :ad_group, class_name: "AdGroup", inverse_of: :callouts
end
