# == Schema Information
#
# Table name: campaigns
#
#  id                 :bigint           not null, primary key
#  daily_budget_cents :integer
#  launched_at        :datetime
#  name               :string
#  stage              :string           default("content")
#  status             :string           default("draft")
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  account_id         :bigint
#  project_id         :bigint
#  website_id         :bigint
#
# Indexes
#
#  index_campaigns_on_account_id             (account_id)
#  index_campaigns_on_account_id_and_stage   (account_id,stage)
#  index_campaigns_on_account_id_and_status  (account_id,status)
#  index_campaigns_on_created_at             (created_at)
#  index_campaigns_on_launched_at            (launched_at)
#  index_campaigns_on_project_id             (project_id)
#  index_campaigns_on_project_id_and_stage   (project_id,stage)
#  index_campaigns_on_project_id_and_status  (project_id,status)
#  index_campaigns_on_stage                  (stage)
#  index_campaigns_on_status                 (status)
#  index_campaigns_on_website_id             (website_id)
#
FactoryBot.define do
  factory :campaign do
    association :account
    association :project
    association :website

    sequence(:name) { |n| "Campaign #{n}" }
    status { "draft" }
  end
end
