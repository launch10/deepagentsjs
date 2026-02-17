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

  def budget_dollars
    daily_budget_cents / 100.0
  end
  alias_method :amount_dollars, :budget_dollars
  alias_method :daily_budget_dollars, :budget_dollars
  alias_method :budget, :budget_dollars
  alias_method :dollars, :budget_dollars

  def cents
    daily_budget_cents
  end

  def google_syncer
    GoogleAds::Resources::Budget.new(self)
  end

  def google_sync
    google_syncer.sync
  end

  def google_synced?
    google_syncer.synced?
  end

  def google_delete
    google_syncer.delete
  end

  def google_fetch
    google_syncer.fetch
  end

  def google_sync_result
    google_syncer.sync_result
  end
end
