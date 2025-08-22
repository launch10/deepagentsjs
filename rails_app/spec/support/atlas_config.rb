# frozen_string_literal: true

# Configure Atlas for tests
RSpec.configure do |config|
  config.before(:suite) do
    # Ensure Atlas is configured for tests
    Atlas.configure do |atlas_config|
      atlas_config.base_url = 'http://localhost:8787'
      atlas_config.api_secret = 'test-secret'
      atlas_config.timeout = 30
    end
  end
end