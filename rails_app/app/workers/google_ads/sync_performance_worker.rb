# frozen_string_literal: true

module GoogleAds
  # Syncs Google Ads performance data using a 7-day rolling window.
  #
  # Uses search_stream for efficient bulk data retrieval.
  # Upserts into ad_performance_daily to handle late-arriving conversions.
  #
  # Why 7-day window: Google Ads conversions have attribution lag - a conversion
  # today might be attributed to a click from 3 days ago. By re-fetching the last
  # 7 days on each sync, we capture these late-arriving conversions.
  #
  class SyncPerformanceWorker < ApplicationWorker
    sidekiq_options queue: :analytics, retry: 3

    ROLLING_WINDOW_DAYS = 7

    def perform
      start_date = ROLLING_WINDOW_DAYS.days.ago.to_date
      end_date = Date.yesterday

      AdsAccount.where(platform: "google").find_each do |ads_account|
        next unless ads_account.google_customer_id.present?

        sync_for_account(ads_account, start_date, end_date)
      rescue StandardError => e
        Rails.logger.error("[SyncPerformanceWorker] Failed for ads_account #{ads_account.id}: #{e.message}")
        Rollbar.error(e, ads_account_id: ads_account.id)
        # Continue processing other accounts
      end
    end

    private

    def sync_for_account(ads_account, start_date, end_date)
      performance_data = Resources::CampaignPerformance.new(ads_account).fetch_daily_metrics(
        start_date: start_date,
        end_date: end_date
      )

      return if performance_data.empty?

      # Map Google campaign IDs to local campaign IDs
      google_campaign_ids = performance_data.map { |d| d[:campaign_id] }.uniq
      campaigns_by_google_id = Campaign
        .where(account: ads_account.account)
        .where("platform_settings->'google'->>'campaign_id' IN (?)", google_campaign_ids.map(&:to_s))
        .index_by { |c| c.google_campaign_id.to_s }

      records_to_upsert = performance_data.filter_map do |data|
        campaign = campaigns_by_google_id[data[:campaign_id].to_s]
        next unless campaign

        {
          campaign_id: campaign.id,
          date: data[:date],
          impressions: data[:impressions],
          clicks: data[:clicks],
          cost_micros: data[:cost_micros],
          conversions: data[:conversions],
          conversion_value_micros: data[:conversion_value_micros],
          created_at: Time.current,
          updated_at: Time.current
        }
      end

      return if records_to_upsert.empty?

      AdPerformanceDaily.upsert_all(
        records_to_upsert,
        unique_by: [:campaign_id, :date]
      )
    end
  end
end
