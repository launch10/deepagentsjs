# frozen_string_literal: true

module Analytics
  # Handles caching for analytics dashboard data.
  #
  # Uses 15-minute time buckets to balance freshness with cache efficiency.
  # For historical data (before today), uses pre-computed data from analytics_daily_metrics.
  # For today's data, queries live from source tables.
  #
  class CacheService
    CACHE_TTL = 15.minutes

    class << self
      # Fetch cached data or compute it.
      #
      # @param account_id [Integer] Account ID
      # @param metric [String] Metric type (e.g., "leads", "page_views")
      # @param days [Integer] Number of days in the range
      # @yield Block that computes the data if cache miss
      # @return [Hash] The cached or computed data
      #
      def fetch(account_id, metric, days, &)
        key = cache_key(account_id, metric, days)
        Rails.cache.fetch(key, expires_in: CACHE_TTL, &)
      end

      # Generate a cache key that includes 15-minute time bucket.
      #
      # @param account_id [Integer] Account ID
      # @param metric [String] Metric type
      # @param days [Integer] Number of days
      # @return [String] Cache key
      #
      def cache_key(account_id, metric, days)
        time_bucket = time_bucket_key
        "analytics:#{account_id}:#{metric}:#{days}:#{time_bucket}"
      end

      # Clear all analytics cache for an account.
      #
      # @param account_id [Integer] Account ID
      #
      def clear_for_account(account_id)
        Rails.cache.delete_matched("analytics:#{account_id}:*")
      end

      private

      # Generate a time bucket key (15-minute intervals).
      # e.g., 10:00, 10:15, 10:30, 10:45
      #
      def time_bucket_key
        now = Time.current
        minute_bucket = (now.min / 15) * 15
        "#{now.strftime("%Y%m%d%H")}#{minute_bucket.to_s.rjust(2, "0")}"
      end
    end
  end
end
