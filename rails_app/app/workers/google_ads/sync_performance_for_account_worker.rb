# frozen_string_literal: true

module GoogleAds
  # Syncs Google Ads performance data for a single account.
  #
  # Uses a 7-day rolling window to capture late-arriving conversions.
  # Called by SyncPerformanceWorker for each account, enabling granular retries.
  #
  class SyncPerformanceForAccountWorker < ApplicationWorker
    sidekiq_options queue: :analytics, retry: 3

    # @param ads_account_id [Integer] The AdsAccount ID to sync
    #
    def perform(ads_account_id)
      ads_account = AdsAccount.find(ads_account_id)
      Analytics::SyncService.new(ads_account).sync_google_ads
    end
  end
end
