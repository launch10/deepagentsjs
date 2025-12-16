module GoogleAds
  module LocationTargeting
    class IngestWorker < ApplicationWorker
      sidekiq_options queue: :default, retry: 3

      def perform
        result = GoogleAds::LocationTargeting.ingest

        if result[:success]
          Rails.logger.info("[GoogleAds::LocationTargeting::IngestWorker] Ingested #{result[:upserted]} geo target constants")
        else
          Rails.logger.error("[GoogleAds::LocationTargeting::IngestWorker] Failed: #{result[:error]}")
          raise "Error ingesting constants" # Retry
        end
      end
    end
  end
end
