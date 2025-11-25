Rails.application.config.to_prepare do
  GoogleAds.configure do |config|
    config.client_id = Rails.application.credentials.dig(:google_ads, :client_id)
    config.client_secret = Rails.application.credentials.dig(:google_ads, :client_secret)
    config.developer_token = Rails.application.credentials.dig(:google_ads, :developer_token)
  end
end
