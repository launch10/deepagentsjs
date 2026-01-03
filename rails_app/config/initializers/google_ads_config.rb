require "google/ads/google_ads"

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
