require "google/ads/google_ads"

Rails.application.config.google_ads = {
  client_id: Rails.application.credentials.dig(:google_ads, :client_id),
  client_secret: Rails.application.credentials.dig(:google_ads, :client_secret),
  refresh_token: Rails.application.credentials.dig(:google_ads, :refresh_token),
  developer_token: Rails.application.credentials.dig(:google_ads, :developer_token),
  account_id: Rails.application.credentials.dig(:google_ads, :account_id),
  login_customer_id: Rails.application.credentials.dig(:google_ads, :account_id)&.tr("-", "")
}
