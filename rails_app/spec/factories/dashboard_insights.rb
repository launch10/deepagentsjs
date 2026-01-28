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
FactoryBot.define do
  factory :dashboard_insight do
    association :account
    insights { [{ title: "Test Insight", description: "Test description", sentiment: "positive", metric_type: "leads" }] }
    generated_at { 1.hour.ago }
  end
end
