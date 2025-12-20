# frozen_string_literal: true

# Configure Atlas admin service integration
Rails.application.config.to_prepare do
  Atlas.configure do |config|
    config.base_url = ENV.fetch("ATLAS_BASE_URL") do
      Rails.env.production? ? "https://atlas-admin.your-domain.com" : "http://localhost:8788"
    end

    config.api_secret = Rails.application.credentials.dig(:atlas, :api_secret) || "development-secret"
    config.timeout = ENV.fetch("ATLAS_TIMEOUT", 30).to_i

    # Set to true to enable syncing to production Atlas from development/test
    # Usage: ALLOW_ATLAS_SYNC=true bin/rails console
    config.allow_sync = ENV.fetch("ALLOW_ATLAS_SYNC", "false") == "true"
  end

  if Rails.env.development?
    Rails.logger.info "[Atlas] Configured with base_url: #{Atlas::BaseService.config.base_url}"
    Rails.logger.info "[Atlas] Sync enabled: #{Atlas::BaseService.config.allow_sync}" if Atlas::BaseService.config.allow_sync
  end
end
