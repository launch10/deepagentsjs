# Cached AI-generated insights for the analytics dashboard.
# One record per account, regenerated when stale (>24 hours).
# == Schema Information
#
# Table name: dashboard_insights
#
#  id              :bigint           not null, primary key
#  generated_at    :datetime         not null
#  insights        :jsonb            not null
#  metrics_summary :jsonb
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#  account_id      :bigint           not null
#
# Indexes
#
#  index_dashboard_insights_on_account_id  (account_id) UNIQUE
#
# Foreign Keys
#
#  fk_rails_...  (account_id => accounts.id)
#
class DashboardInsight < ApplicationRecord
  FRESHNESS_DURATION = 24.hours

  belongs_to :account

  validates :account, presence: true
  validates :insights, presence: true
  validates :generated_at, presence: true

  # Check if insights are still fresh (< 24 hours old)
  def fresh?
    generated_at > FRESHNESS_DURATION.ago
  end

  # Inverse of fresh? for readability
  def stale?
    !fresh?
  end
end
