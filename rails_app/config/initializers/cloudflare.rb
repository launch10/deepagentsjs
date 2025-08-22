# frozen_string_literal: true

Rails.application.config.after_initialize do
  Cloudflare.configure do |config|
    config.api_token = ENV.fetch('CLOUDFLARE_API_TOKEN') do
      Rails.application.credentials.dig(:cloudflare, :api_token)
    end
    
    config.account_id = ENV.fetch('CLOUDFLARE_ACCOUNT_ID') do
      Rails.application.credentials.dig(:cloudflare, :account_id)
    end
    
    config.analytics_endpoint = ENV.fetch('CLOUDFLARE_ANALYTICS_ENDPOINT') do
      Rails.application.credentials.dig(:cloudflare, :analytics_endpoint) || "https://api.cloudflare.com/client/v4/graphql"
    end
    
    config.r2_endpoint = ENV.fetch('CLOUDFLARE_R2_ENDPOINT') do
      Rails.application.credentials.dig(:cloudflare, :r2_endpoint)
    end
    
    config.r2_access_key_id = ENV.fetch('CLOUDFLARE_R2_ACCESS_KEY_ID') do
      Rails.application.credentials.dig(:cloudflare, :r2_access_key_id)
    end
    
    config.r2_secret_access_key = ENV.fetch('CLOUDFLARE_R2_SECRET_ACCESS_KEY') do
      Rails.application.credentials.dig(:cloudflare, :r2_secret_access_key)
    end
    
    config.r2_bucket_name = ENV.fetch('CLOUDFLARE_R2_BUCKET_NAME') do
      Rails.application.credentials.dig(:cloudflare, :r2_bucket_name) || 'deploys'
    end
    
    config.r2_region = ENV.fetch('CLOUDFLARE_R2_REGION') do
      Rails.application.credentials.dig(:cloudflare, :r2_region) || 'auto'
    end
    
    config.timeout = ENV.fetch('CLOUDFLARE_TIMEOUT', 30).to_i
  end
  
  if Rails.env.development?
    Rails.logger.info "[Cloudflare] Configured with endpoint: #{Cloudflare.config.analytics_endpoint}"
    Rails.logger.info "[Cloudflare] R2 bucket: #{Cloudflare.config.r2_bucket_name}"
  end
end