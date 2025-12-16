module GoogleAds
  include ActiveSupport::Configurable

  config_accessor :client_id
  config_accessor :client_secret
  config_accessor :developer_token

  class << self
    def client
      @client ||= Google::Ads::GoogleAds::GoogleAdsClient.new do |c|
        c.client_id = Rails.application.credentials.dig(:google_ads, :client_id)
        c.client_secret = Rails.application.credentials.dig(:google_ads, :client_secret)
        c.refresh_token = Rails.application.credentials.dig(:google_ads, :refresh_token)
        c.developer_token = Rails.application.credentials.dig(:google_ads, :developer_token)
        c.login_customer_id = Rails.application.credentials.dig(:google_ads, :login_customer_id)
      end
    end
  end
end
