require "google/ads/google_ads"

# Google Ads API Logger
# - Production: Rails.logger (INFO level - summaries only)
# - Development/Test: Dedicated file (DEBUG level - full request/response payloads)
Rails.application.config.google_ads_logger = if Rails.env.production?
  ActiveSupport::TaggedLogging.new(Rails.logger)
else
  ActiveSupport::TaggedLogging.new(
    Logger.new(Rails.root.join("log", "google_ads.log")).tap do |logger|
      logger.level = Logger::DEBUG
    end
  )
end

# Allow GOOGLE_ADS_LOGIN_CUSTOMER_ID env var to override credentials for testing
login_customer_id = ENV["GOOGLE_ADS_LOGIN_CUSTOMER_ID"] ||
  Rails.application.credentials.dig(:google_ads, :account_id)&.tr("-", "")

Rails.application.config.google_ads = {
  client_id: Rails.application.credentials.dig(:google_ads, :client_id),
  client_secret: Rails.application.credentials.dig(:google_ads, :client_secret),
  refresh_token: Rails.application.credentials.dig(:google_ads, :refresh_token),
  developer_token: Rails.application.credentials.dig(:google_ads, :developer_token),
  account_id: Rails.application.credentials.dig(:google_ads, :account_id),
  login_customer_id: login_customer_id
}
