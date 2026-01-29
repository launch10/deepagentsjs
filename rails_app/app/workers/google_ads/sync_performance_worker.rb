# frozen_string_literal: true

module GoogleAds
  # Enqueues sync jobs for each eligible Google Ads account.
  #
  # Only processes accounts that:
  # - Have a Google customer ID configured
  # - Belong to an account with an active subscription
  #
  # This is a batch coordinator - it iterates over accounts and enqueues
  # individual SyncPerformanceForAccountWorker jobs for granular retries.
  #
  class SyncPerformanceWorker < ApplicationWorker
    sidekiq_options queue: :analytics, retry: 3

    def perform
      self.class.eligible_ads_accounts.find_each do |ads_account|
        GoogleAds::SyncPerformanceForAccountWorker.perform_async(ads_account.id)
      end
    end

    # Google Ads accounts with customer IDs belonging to subscribed accounts.
    #
    # Uses indexed columns:
    # - ads_accounts.platform
    # - ads_accounts.platform_settings (GIN index + expression index on google customer_id)
    # - pay_subscriptions.status (index_pay_subscriptions_on_status)
    #
    # @return [ActiveRecord::Relation<AdsAccount>]
    #
    def self.eligible_ads_accounts
      AdsAccount
        .joins(:account)
        .joins("INNER JOIN pay_customers ON pay_customers.owner_id = accounts.id AND pay_customers.owner_type = 'Account'")
        .joins("INNER JOIN pay_subscriptions ON pay_subscriptions.customer_id = pay_customers.id")
        .where(platform: "google")
        .where("ads_accounts.platform_settings->'google'->>'customer_id' IS NOT NULL")
        .where("ads_accounts.platform_settings->'google'->>'customer_id' != ''")
        .where(pay_subscriptions: { status: "active" })
    end
  end
end
