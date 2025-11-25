# == Schema Information
#
# Table name: campaigns
#
#  id                 :bigint           not null, primary key
#  daily_budget_cents :integer
#  end_date           :date
#  launched_at        :datetime
#  name               :string
#  platform_settings  :jsonb
#  stage              :string           default("content")
#  start_date         :date
#  status             :string           default("draft")
#  time_zone          :string           default("America/New_York")
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  account_id         :bigint
#  ads_account_id     :bigint
#  project_id         :bigint
#  website_id         :bigint
#
# Indexes
#
#  index_campaigns_on_account_id             (account_id)
#  index_campaigns_on_account_id_and_stage   (account_id,stage)
#  index_campaigns_on_account_id_and_status  (account_id,status)
#  index_campaigns_on_ads_account_id         (ads_account_id)
#  index_campaigns_on_created_at             (created_at)
#  index_campaigns_on_end_date               (end_date)
#  index_campaigns_on_google_id              (((platform_settings ->> 'google'::text)))
#  index_campaigns_on_launched_at            (launched_at)
#  index_campaigns_on_platform_settings      (platform_settings) USING gin
#  index_campaigns_on_project_id             (project_id)
#  index_campaigns_on_project_id_and_stage   (project_id,stage)
#  index_campaigns_on_project_id_and_status  (project_id,status)
#  index_campaigns_on_stage                  (stage)
#  index_campaigns_on_start_date             (start_date)
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
