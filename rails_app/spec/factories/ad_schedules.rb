# == Schema Information
#
# Table name: ad_schedules
#
#  id                :bigint           not null, primary key
#  always_on         :boolean          default(FALSE)
#  bid_modifier      :decimal(10, 2)
#  day_of_week       :string
#  deleted_at        :datetime
#  end_hour          :integer
#  end_minute        :integer
#  platform_settings :jsonb
#  start_hour        :integer
#  start_minute      :integer
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  campaign_id       :bigint           not null
#
# Indexes
#
#  index_ad_schedules_on_always_on                    (always_on)
#  index_ad_schedules_on_campaign_id                  (campaign_id)
#  index_ad_schedules_on_campaign_id_and_day_of_week  (campaign_id,day_of_week)
#  index_ad_schedules_on_created_at                   (created_at)
#  index_ad_schedules_on_criterion_id                 ((((platform_settings -> 'google'::text) ->> 'criterion_id'::text)))
#  index_ad_schedules_on_day_of_week                  (day_of_week)
#  index_ad_schedules_on_deleted_at                   (deleted_at)
#  index_ad_schedules_on_platform_settings            (platform_settings) USING gin
#
FactoryBot.define do
  factory :ad_schedule do
    association :campaign
    day_of_week { "Monday" }
    start_hour { 9 }
    start_minute { 0 }
    end_hour { 17 }
    end_minute { 0 }
    always_on { false }
    platform_settings { {} }

    trait :always_on do
      day_of_week { nil }
      start_hour { nil }
      start_minute { nil }
      end_hour { nil }
      end_minute { nil }
      always_on { true }
    end

    trait :with_criterion_id do
      platform_settings { { "google" => { "criterion_id" => "123456" } } }
    end
  end
end
