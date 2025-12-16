module GoogleAds
  module LocationTargeting
    BASE_URL = "https://developers.google.com/static/google-ads/api/data/geo".freeze
    CSV_PREFIX = "geotargets".freeze

    class << self
      def ingest
        IngestData.call
      end
    end
  end
end
