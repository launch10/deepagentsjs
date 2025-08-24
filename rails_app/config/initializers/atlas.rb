# frozen_string_literal: true

# Configure Atlas admin service integration
Rails.application.config.to_prepare do
  Atlas.configure do |config|
    config.base_url = ENV.fetch('ATLAS_BASE_URL') do
      Rails.env.production? ? 'https://atlas-admin.your-domain.com' : 'http://localhost:8788'
    end

    config.api_secret = ENV.fetch('ATLAS_API_SECRET') do
      Rails.application.credentials.dig(:atlas, :api_secret) || 'development-secret'
    end

    config.timeout = ENV.fetch('ATLAS_TIMEOUT', 30).to_i
  end

  if Rails.env.development?
    Rails.logger.info "[Atlas] Configured with base_url: #{Atlas::BaseService.config.base_url}"
  end
end