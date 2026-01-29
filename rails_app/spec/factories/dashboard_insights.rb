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
    insights do
      [
        {
          title: "Lead Generation Up",
          description: "Leads increased by 23% this week.",
          sentiment: "positive",
          project_uuid: nil,
          action: { label: "View Analytics", url: "/dashboard" }
        },
        {
          title: "Project Needs Attention",
          description: "One project hasn't generated leads recently.",
          sentiment: "negative",
          project_uuid: nil,
          action: { label: "Review Project", url: "/projects" }
        },
        {
          title: "CTR Improving",
          description: "Click-through rate trending upward.",
          sentiment: "neutral",
          project_uuid: nil,
          action: { label: "View Details", url: "/dashboard" }
        }
      ]
    end
    generated_at { 1.hour.ago }
  end
end
