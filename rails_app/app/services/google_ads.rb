module GoogleAds
  class << self
    def config
      Rails.application.config.google_ads
    end

    def is_test_mode?
      !Rails.env.production?
    end

    # Log level for Google Ads API requests:
    # - Production: INFO (summaries only - customer ID, method, request ID, fault status)
    # - Development/Test: DEBUG (full request/response payloads as JSON)
    #
    # Logs are tagged with ActiveSupport::TaggedLogging and can be filtered
    # using GoogleAds::Instrumentation.with_context for domain model correlation.
    #
    def log_level
      Rails.env.production? ? "INFO" : "DEBUG"
    end

    def client
      @client ||= Google::Ads::GoogleAds::GoogleAdsClient.new do |c|
        c.client_id = config[:client_id]
        c.client_secret = config[:client_secret]
        c.refresh_token = config[:refresh_token]
        c.developer_token = config[:developer_token]
        c.login_customer_id = config[:login_customer_id]

        # Enable Google Ads API request logging
        c.log_level = log_level
        c.logger = Rails.logger
      end
    end

    # Reset client (useful for testing or credential rotation)
    def reset_client!
      @client = nil
    end
  end
end
