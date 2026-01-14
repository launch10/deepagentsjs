Sidekiq.strict_args!(false)

# Run Sidekiq jobs inline for E2E/Playwright tests only.
# Regular RSpec tests use fake mode (jobs queued but not executed).
# Set SIDEKIQ_INLINE=true via bin/dev-test for e2e tests.
if Rails.env.test? && ENV["SIDEKIQ_INLINE"] == "true"
  require "sidekiq/testing"
  Sidekiq::Testing.inline!
end
