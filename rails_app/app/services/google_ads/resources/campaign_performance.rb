# frozen_string_literal: true

module GoogleAds
  module Resources
    # Fetches campaign performance metrics from Google Ads API.
    #
    # Uses search_stream for efficient bulk data retrieval.
    # Returns raw metrics exactly as returned from API.
    #
    class CampaignPerformance
      attr_reader :ads_account

      def initialize(ads_account)
        @ads_account = ads_account
      end

      # Fetch daily performance metrics for all campaigns in the account.
      #
      # @param start_date [Date] Start of date range (inclusive)
      # @param end_date [Date] End of date range (inclusive)
      # @return [Array<Hash>] Array of metric hashes per campaign per day
      #
      def fetch_daily_metrics(start_date:, end_date:)
        return [] unless customer_id.present?

        results = []

        begin
          client.service.google_ads.search_stream(
            customer_id: customer_id,
            query: performance_query(start_date, end_date)
          ) do |response|
            response.results.each do |row|
              results << extract_metrics(row)
            end
          end
        rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
          Rails.logger.error("[CampaignPerformance] Failed to fetch metrics: #{e.message}")
          Rollbar.error(e, ads_account_id: ads_account.id)
          return []
        end

        results
      end

      private

      def extract_metrics(row)
        {
          campaign_id: row.campaign.id,
          campaign_name: row.campaign.name,
          date: Date.parse(row.segments.date),
          impressions: row.metrics.impressions.to_i,
          clicks: row.metrics.clicks.to_i,
          cost_micros: row.metrics.cost_micros.to_i,
          conversions: row.metrics.conversions.to_f,
          conversion_value_micros: (row.metrics.conversions_value * 1_000_000).to_i
        }
      end

      def performance_query(start_date, end_date)
        <<~GAQL.squish
          SELECT
            campaign.id,
            campaign.name,
            segments.date,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
          FROM campaign
          WHERE segments.date >= '#{start_date.strftime('%Y-%m-%d')}'
            AND segments.date <= '#{end_date.strftime('%Y-%m-%d')}'
            AND campaign.status != 'REMOVED'
        GAQL
      end

      def client
        GoogleAds.client
      end

      def customer_id
        ads_account.google_customer_id&.gsub("-", "")
      end
    end
  end
end
