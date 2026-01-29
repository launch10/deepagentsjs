# frozen_string_literal: true

module Analytics
  # Orchestrates syncing raw performance data from external sources.
  #
  # Currently supports:
  # - Google Ads (via SyncPerformanceWorker)
  #
  # Uses a 7-day rolling window to capture late-arriving conversions.
  #
  class SyncService
    ROLLING_WINDOW_DAYS = 7

    def initialize(ads_account)
      @ads_account = ads_account
    end

    # Sync Google Ads performance data for the rolling window.
    #
    # @return [Integer] Number of records upserted
    #
    def sync_google_ads
      return 0 unless @ads_account.google_customer_id.present?

      start_date = ROLLING_WINDOW_DAYS.days.ago.to_date
      end_date = Date.yesterday

      performance_data = fetch_google_ads_data(start_date, end_date)
      return 0 if performance_data.empty?

      upsert_performance_data(performance_data)
    end

    private

    def fetch_google_ads_data(start_date, end_date)
      GoogleAds::Resources::CampaignPerformance
        .new(@ads_account)
        .fetch_daily_metrics(start_date: start_date, end_date: end_date)
    end

    def upsert_performance_data(performance_data)
      # Map Google campaign IDs to local campaign IDs
      google_campaign_ids = performance_data.map { |d| d[:campaign_id] }.uniq
      campaigns_by_google_id = Campaign
        .where(account: @ads_account.account)
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

      return 0 if records_to_upsert.empty?

      AdPerformanceDaily.upsert_all(
        records_to_upsert,
        unique_by: [:campaign_id, :date]
      )

      records_to_upsert.size
    end
  end
end
