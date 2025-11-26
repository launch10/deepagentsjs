# == Schema Information
#
# Table name: ad_budgets
#
#  id                 :bigint           not null, primary key
#  daily_budget_cents :integer
#  platform_settings  :jsonb
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  campaign_id        :bigint
#
# Indexes
#
#  index_ad_budgets_on_campaign_id        (campaign_id)
#  index_ad_budgets_on_google_id          ((((platform_settings -> 'google'::text) ->> 'budget_id'::text)))
#  index_ad_budgets_on_platform_settings  (platform_settings) USING gin
#
class AdBudget < ApplicationRecord
  include PlatformSettings
  belongs_to :campaign
  platform_setting :google, :budget_id
end
