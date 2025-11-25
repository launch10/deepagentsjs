require 'google/ads/google_ads'

Google::Ads::GoogleAds::Config.new do |c|
  c.client_id = Rails.application.credentials.dig(:google_ads, :client_id)
  c.client_secret = Rails.application.credentials.dig(:google_ads, :client_secret)
  c.refresh_token = Rails.application.credentials.dig(:google_ads, :refresh_token)
  c.developer_token = Rails.application.credentials.dig(:google_ads, :developer_token)
  c.login_customer_id = ENV['GOOGLE_ADS_MANAGER_ID']&.tr('-', '') || Rails.application.credentials.dig(:google_ads, :login_customer_id)
end