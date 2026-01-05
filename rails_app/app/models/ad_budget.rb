# == Schema Information
#
# Table name: ad_budgets
#
#  id                 :bigint           not null, primary key
#  daily_budget_cents :integer
#  deleted_at         :datetime
#  platform_settings  :jsonb
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  campaign_id        :bigint
#
# Indexes
#
#  index_ad_budgets_on_campaign_id        (campaign_id)
#  index_ad_budgets_on_deleted_at         (deleted_at)
#  index_ad_budgets_on_google_id          ((((platform_settings -> 'google'::text) ->> 'budget_id'::text)))
#  index_ad_budgets_on_platform_settings  (platform_settings) USING gin
#
class AdBudget < ApplicationRecord
  include PlatformSettings

  belongs_to :campaign

  platform_setting :google, :budget_id
  platform_setting :google, :budget_name, default: -> { Time.now.utc.strftime("%Y-%m-%d %H:%M:%S") }

  acts_as_paranoid

  # ═══════════════════════════════════════════════════════════════
  # GOOGLE SYNC (explicit one-liner delegations, no DSL magic)
  # Callback logic (save_budget_id) is INSIDE the resource
  # ═══════════════════════════════════════════════════════════════

  def google_sync = GoogleAds::Resources::Budget.new(self).sync
  def google_synced? = GoogleAds::Resources::Budget.new(self).synced?
  def google_delete = GoogleAds::Resources::Budget.new(self).delete
  def google_fetch = GoogleAds::Resources::Budget.new(self).fetch
  def google_syncer = GoogleAds::Resources::Budget.new(self)
end
