# == Schema Information
#
# Table name: analytics_daily_metrics
#
#  id                    :bigint           not null, primary key
#  clicks                :bigint           default(0), not null
#  cost_micros           :bigint           default(0), not null
#  date                  :date             not null
#  deleted_at            :datetime
#  impressions           :bigint           default(0), not null
#  leads_count           :integer          default(0), not null
#  page_views_count      :bigint           default(0), not null
#  unique_visitors_count :bigint           default(0), not null
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  account_id            :bigint           not null
#  project_id            :bigint           not null
#
# Indexes
#
#  idx_analytics_daily_acct_date                (account_id,date)
#  idx_analytics_daily_acct_proj_date           (account_id,project_id,date) UNIQUE
#  idx_analytics_daily_proj_date                (project_id,date)
#  index_analytics_daily_metrics_on_deleted_at  (deleted_at)
#
# Foreign Keys
#
#  fk_rails_...  (account_id => accounts.id)
#  fk_rails_...  (project_id => projects.id)
#
FactoryBot.define do
  factory :analytics_daily_metric do
    association :account
    association :project
    date { Date.yesterday }
    leads_count { 10 }
    unique_visitors_count { 100 }  # Ahoy::Visit count (sessions)
    page_views_count { 500 }       # Ahoy::Event page_view count
    impressions { 1000 }
    clicks { 50 }
    cost_micros { 25_000_000 } # $25
  end
end
