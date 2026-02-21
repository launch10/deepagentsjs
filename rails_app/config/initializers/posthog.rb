require "posthog"

POSTHOG = if (api_key = Rails.application.credentials.dig(:posthog, :api_key) || ENV["POSTHOG_API_KEY"]).present?
  PostHog::Client.new(
    api_key: api_key,
    host: ENV.fetch("POSTHOG_HOST", "https://us.i.posthog.com"),
    on_error: proc { |status, msg| Rails.logger.error("PostHog: #{status} #{msg}") }
  )
end
