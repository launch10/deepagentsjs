class Cloudflare
  include ActiveSupport::Configurable

  config_accessor :api_token
  config_accessor :email
  config_accessor :account_id
  config_accessor :analytics_endpoint, default: "https://api.cloudflare.com/client/v4/graphql"
  config_accessor :blocked_domains_list_id
  config_accessor :deploy_env
  config_accessor :r2_endpoint
  config_accessor :r2_bucket, default: "deploys"
  config_accessor :r2_region, default: "auto"
  config_accessor :r2_access_key_id
  config_accessor :r2_secret_access_key
  config_accessor :timeout, default: 30
end