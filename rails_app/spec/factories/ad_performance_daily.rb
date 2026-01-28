# == Schema Information
#
# Table name: ad_performance_daily
#
#  id                      :bigint           not null, primary key
#  clicks                  :bigint           default(0), not null
#  conversion_value_micros :bigint           default(0), not null
#  conversions             :decimal(12, 2)   default(0.0), not null
#  cost_micros             :bigint           default(0), not null
#  date                    :date             not null
#  impressions             :bigint           default(0), not null
#  created_at              :datetime         not null
#  updated_at              :datetime         not null
#  campaign_id             :bigint           not null
#
# Indexes
#
#  idx_ad_perf_daily_campaign_date     (campaign_id,date) UNIQUE
#  index_ad_performance_daily_on_date  (date)
#
# Foreign Keys
#
#  fk_rails_...  (campaign_id => campaigns.id)
#
FactoryBot.define do
  factory :ad_performance_daily do
    association :campaign
    date { Date.yesterday }
    impressions { 1000 }
    clicks { 50 }
    cost_micros { 25_000_000 } # $25
    conversions { 5.0 }
    conversion_value_micros { 500_000_000 } # $500
  end
end
