# frozen_string_literal: true

Rails.application.config.after_initialize do
  Cloudflare.configure do |config|
    config.api_token = Rails.application.credentials.dig(:cloudflare, :api_token)
    config.account_id = Rails.application.credentials.dig(:cloudflare, :account_id)
    config.analytics_endpoint = Rails.application.credentials.dig(:cloudflare, :analytics_endpoint)
    config.r2_endpoint = Rails.application.credentials.dig(:cloudflare, :r2_endpoint)
    config.r2_access_key_id = Rails.application.credentials.dig(:cloudflare, :r2_access_key_id)
    config.r2_secret_access_key = Rails.application.credentials.dig(:cloudflare, :r2_secret_access_key)
    config.r2_bucket_name = Rails.application.credentials.dig(:cloudflare, :r2_bucket_name)
    config.r2_region = Rails.application.credentials.dig(:cloudflare, :r2_region)
    config.timeout = ENV.fetch('CLOUDFLARE_TIMEOUT', 30).to_i
  end
end