module GoogleAds
  include ActiveSupport::Configurable

  config_accessor :client_id
  config_accessor :client_secret
  config_accessor :developer_token
end
