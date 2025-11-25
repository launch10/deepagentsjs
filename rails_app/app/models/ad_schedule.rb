# == Schema Information
#
# Table name: ad_schedules
#
#  id                    :bigint           not null, primary key
#  bid_modifier          :decimal(10, 2)
#  day_of_week           :string           not null
#  end_hour              :integer          not null
#  end_minute            :integer          not null
#  start_hour            :integer          not null
#  start_minute          :integer          not null
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  campaign_id           :bigint           not null
#  platform_criterion_id :string
#
# Indexes
#
#  index_ad_schedules_on_campaign_id                  (campaign_id)
#  index_ad_schedules_on_campaign_id_and_day_of_week  (campaign_id,day_of_week)
#  index_ad_schedules_on_created_at                   (created_at)
#  index_ad_schedules_on_day_of_week                  (day_of_week)
#
class AdSchedule < ApplicationRecord
  belongs_to :campaign
end
