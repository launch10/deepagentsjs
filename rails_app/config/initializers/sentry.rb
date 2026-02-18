Sentry.init do |config|
  config.dsn = Rails.application.credentials.dig(:sentry, :dsn)
  config.breadcrumbs_logger = [:active_support_logger, :http_logger]
  config.enabled_environments = %w[production staging]
  config.sample_rate = 1.0
  config.traces_sample_rate = 0.0
  config.send_default_pii = false
  config.release = ENV["GIT_SHA"] || `git rev-parse HEAD`.strip rescue "unknown"
  config.environment = Rails.env
end
