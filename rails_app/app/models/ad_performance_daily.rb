# Raw Google Ads performance data per campaign per day.
# Stored exactly as returned from the API - no transformations.
# Used as source of truth for analytics_daily_metrics transforms.
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
#  deleted_at              :datetime
#  impressions             :bigint           default(0), not null
#  created_at              :datetime         not null
#  updated_at              :datetime         not null
#  campaign_id             :bigint           not null
#
# Indexes
#
#  idx_ad_perf_daily_campaign_date           (campaign_id,date) UNIQUE
#  index_ad_performance_daily_on_date        (date)
#  index_ad_performance_daily_on_deleted_at  (deleted_at)
#
# Foreign Keys
#
#  fk_rails_...  (campaign_id => campaigns.id)
#
class AdPerformanceDaily < ApplicationRecord
  acts_as_paranoid

  self.table_name = "ad_performance_daily"

  belongs_to :campaign

  validates :campaign_id, presence: true
  validates :date, presence: true, uniqueness: { scope: :campaign_id }

  # Scopes for querying
  scope :for_campaign, ->(campaign) { where(campaign: campaign) }
  scope :for_date_range, ->(start_date, end_date) { where(date: start_date..end_date) }
  scope :for_date, ->(date) { where(date: date) }

  # Convenience: dollars from micros (for display only - raw data stays as micros)
  def cost_dollars
    cost_micros / 1_000_000.0
  end

  def conversion_value_dollars
    conversion_value_micros / 1_000_000.0
  end

  # Computed CTR (for display)
  def ctr
    return nil if impressions.zero?
    clicks.to_f / impressions
  end
end
