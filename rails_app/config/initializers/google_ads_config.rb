require "google/ads/google_ads"

Google::Ads::GoogleAds::Config.new do |c|
  c.client_id = Rails.application.credentials.dig(:google_ads, :client_id)
  c.client_secret = Rails.application.credentials.dig(:google_ads, :client_secret)
  c.refresh_token = Rails.application.credentials.dig(:google_ads, :refresh_token)
  c.developer_token = Rails.application.credentials.dig(:google_ads, :developer_token)
  c.account_id = Rails.application.credentials.dig(:google_ads, :account_id)
  c.login_customer_id = c.account_id&.tr("-", "")
end
