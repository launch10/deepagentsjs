module GoogleAds
  class << self
    def config
      Rails.application.config.google_ads
    end

    def is_test_mode?
      !Rails.env.production?
    end

    def client
      @client ||= Google::Ads::GoogleAds::GoogleAdsClient.new do |c|
        c.client_id = config[:client_id]
        c.client_secret = config[:client_secret]
        c.refresh_token = config[:refresh_token]
        c.developer_token = config[:developer_token]
        c.login_customer_id = config[:login_customer_id]
      end
    end
  end
end
