# frozen_string_literal: true

# Helpers for testing internal service-to-service API authentication.
# Used for endpoints that accept HMAC signature auth instead of JWT (e.g., Langgraph -> Rails).
module InternalAPIHelpers
  def generate_internal_signature(timestamp)
    secret = Rails.application.credentials.devise_jwt_secret_key!
    OpenSSL::HMAC.hexdigest("SHA256", secret, timestamp.to_s)
  end

  def internal_headers(timestamp = Time.current.to_i.to_s)
    {
      "X-Signature" => generate_internal_signature(timestamp),
      "X-Timestamp" => timestamp
    }
  end
end

RSpec.configure do |config|
  config.include InternalAPIHelpers, type: :request
end
