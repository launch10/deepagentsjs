# Transformed/aggregated analytics data for dashboard display.
# One row per project per day. Computed from raw sources by workers.
# Can be fully recomputed from ad_performance_daily, website_leads, domain_request_counts.
# == Schema Information
#
# Table name: analytics_daily_metrics
#
#  id                     :bigint           not null, primary key
#  clicks                 :bigint           default(0), not null
#  conversion_value_cents :bigint           default(0), not null
#  cost_micros            :bigint           default(0), not null
#  date                   :date             not null
#  impressions            :bigint           default(0), not null
#  leads_count            :integer          default(0), not null
#  page_views_count       :bigint           default(0), not null
#  unique_visitors_count  :bigint           default(0), not null
#  created_at             :datetime         not null
#  updated_at             :datetime         not null
#  account_id             :bigint           not null
#  project_id             :bigint           not null
#
# Indexes
#
#  idx_analytics_daily_acct_date       (account_id,date)
#  idx_analytics_daily_acct_proj_date  (account_id,project_id,date) UNIQUE
#  idx_analytics_daily_proj_date       (project_id,date)
#
# Foreign Keys
#
#  fk_rails_...  (account_id => accounts.id)
#  fk_rails_...  (project_id => projects.id)
#
class AnalyticsDailyMetric < ApplicationRecord
  belongs_to :account
  belongs_to :project

  validates :account_id, presence: true
  validates :project_id, presence: true
  validates :date, presence: true, uniqueness: { scope: [:account_id, :project_id] }

  # Scopes for querying
  scope :for_account, ->(account) { where(account: account) }
  scope :for_project, ->(project) { where(project: project) }
  scope :for_date_range, ->(start_date, end_date) { where(date: start_date..end_date) }
  scope :for_date, ->(date) { where(date: date) }

  # Computed metrics for display

  # Click-through rate: clicks / impressions
  def ctr
    return nil if impressions.zero?
    clicks.to_f / impressions
  end

  # Cost per lead in dollars
  def cpl_dollars
    return nil if leads_count.zero?
    cost_dollars / leads_count
  end

  # Total cost in dollars (from micros)
  def cost_dollars
    cost_micros / 1_000_000.0
  end

  # Conversion value in dollars (from cents)
  def conversion_value_dollars
    conversion_value_cents / 100.0
  end

  # Return on Ad Spend: conversion_value / cost
  def roas
    return nil if cost_micros.zero?
    conversion_value_dollars / cost_dollars
  end
end
